import { spawnSync } from "node:child_process";
import { chmodSync, closeSync, existsSync, fchmodSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const confirmation = "RESTORE PRODUCTION";
const postgresClientImage = "postgres:18-alpine";
const vercelProject = "edu";
const vercelScope = "trinhan";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryDir = mkdtempSync(path.join(os.tmpdir(), "edu-db-restore-"));
chmodSync(temporaryDir, 0o700);
let containerId = "";

function run(command, args, options = {}) {
	const result = spawnSync(command, args, {
		cwd: rootDir,
		encoding: "utf8",
		stdio: "inherit",
		...options,
	});

	if (result.error) {
		throw result.error;
	}
	if (result.status !== 0) {
		throw new Error(`${command} failed with exit code ${result.status ?? "unknown"}`);
	}

	return result;
}

function capture(command, args, options = {}) {
	const result = spawnSync(command, args, {
		cwd: rootDir,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "inherit"],
		...options,
	});

	if (result.error) {
		throw result.error;
	}
	if (result.status !== 0) {
		throw new Error(`${command} failed with exit code ${result.status ?? "unknown"}`);
	}

	return result.stdout.trim();
}

function parseEnvFile(filePath) {
	const values = new Map();
	for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
		const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
		if (!match) continue;

		let value = match[2] ?? "";
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1);
		}
		values.set(match[1], value);
	}
	return values;
}

function escapePgPass(value) {
	return value.replaceAll("\\", "\\\\").replaceAll(":", "\\:").replaceAll("\n", "\\n");
}

function connectionFromUrl(rawUrl) {
	const url = new URL(rawUrl);
	const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
	const connection = {
		host: url.hostname,
		port: url.port || "5432",
		database,
		username: decodeURIComponent(url.username),
		password: decodeURIComponent(url.password),
	};

	if (!connection.host.endsWith(".neon.tech") || connection.host.includes("-pooler.")) {
		throw new Error("DATABASE_URL_UNPOOLED không phải endpoint Neon trực tiếp (direct/non-pooled).");
	}
	if (!connection.database || !connection.username || !connection.password) {
		throw new Error("DATABASE_URL_UNPOOLED thiếu thông tin kết nối cần thiết.");
	}

	return connection;
}

function pgArgs(connection) {
	return [
		"--host", connection.host,
		"--port", connection.port,
		"--username", connection.username,
		"--dbname", connection.database,
		"--no-password",
	];
}

function runWithFileOutput(command, args, outputPath, options = {}) {
	const fd = openSync(outputPath, "w", 0o600);
	fchmodSync(fd, 0o600);
	let completed = false;
	try {
		run(command, args, { stdio: ["ignore", fd, "inherit"], ...options });
		completed = true;
	} finally {
		closeSync(fd);
		if (!completed) rmSync(outputPath, { force: true });
	}
}

function runWithFileInput(command, args, inputPath, options = {}) {
	const fd = openSync(inputPath, "r");
	try {
		run(command, args, { stdio: [fd, "inherit", "inherit"], ...options });
	} finally {
		closeSync(fd);
	}
}

function cleanup() {
	rmSync(temporaryDir, { recursive: true, force: true });
}

function postgresClientArgs(passFile, command, args) {
	return [
		"run", "--rm", "-i",
		"-v", `${passFile}:/run/secrets/edu-pgpass:ro`,
		"-e", "PGPASSFILE=/run/secrets/edu-pgpass",
		"-e", "PGSSLMODE=require",
		postgresClientImage,
		command,
		...args,
	];
}

try {
	if (process.argv[2] !== confirmation) {
		throw new Error(`Đã dừng an toàn. Muốn tiếp tục phải nhập chính xác: ${confirmation}`);
	}

	console.log("=== BACKUP LOCAL + BACKUP PRODUCTION + RESTORE ===");
	console.log("⚠ Restore sẽ thay thế schema và dữ liệu hiện có trên Neon Production.");

	console.log("\n▶ Kiểm tra xác thực Vercel");
	const vercelIdentity = spawnSync("npx", ["vercel", "whoami"], {
		cwd: rootDir,
		stdio: "inherit",
	});
	if (vercelIdentity.error) throw vercelIdentity.error;
	if (vercelIdentity.status !== 0) {
		console.log("Chưa đăng nhập. Vercel CLI sẽ yêu cầu xác thực trong terminal/trình duyệt.");
		run("npx", ["vercel", "login"]);
		run("npx", ["vercel", "whoami"]);
	}

	console.log("\n▶ Tải cấu hình Production vào thư mục tạm bảo vệ");
	const productionEnvFile = path.join(temporaryDir, "production.env");
	run("npx", [
		"vercel", "env", "pull", productionEnvFile,
		"--environment=production", "--yes",
		"--project", vercelProject, "--scope", vercelScope,
	]);
	chmodSync(productionEnvFile, 0o600);
	const productionVars = parseEnvFile(productionEnvFile);
	const rawDirectUrl = productionVars.get("DATABASE_URL_UNPOOLED");
	if (!rawDirectUrl) {
		throw new Error("Không tìm thấy DATABASE_URL_UNPOOLED trong Production env; dừng trước khi restore.");
	}
	const production = connectionFromUrl(rawDirectUrl);
	console.log(`✓ Đích xác nhận là Neon direct endpoint, database: ${production.database}`);

	console.log("\n▶ Kiểm tra Docker và container PostgreSQL local");
	containerId = capture("docker", ["compose", "ps", "-q", "postgres"]);
	if (!containerId) {
		throw new Error("Không tìm thấy container service postgres. Hãy khởi động DB local trước.");
	}
	const postgresClientVersion = capture("docker", ["run", "--rm", postgresClientImage, "pg_dump", "--version"]);
	console.log(`✓ Client PostgreSQL cho Neon: ${postgresClientVersion}`);
	const localEnv = existsSync(path.join(rootDir, ".env"))
		? parseEnvFile(path.join(rootDir, ".env"))
		: new Map();
	const localUser = localEnv.get("POSTGRES_USER") || "postgres";
	const localDatabase = localEnv.get("DB_NAME") || "classroom_rental";

	const backupDir = process.env.EDU_DB_BACKUP_DIR
		? path.resolve(process.env.EDU_DB_BACKUP_DIR)
		: path.join(os.homedir(), ".local", "share", "edu", "backups");
	mkdirSync(backupDir, { recursive: true, mode: 0o700 });
	chmodSync(backupDir, 0o700);
	const stamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
	const localBackup = path.join(backupDir, `classroom-rental-local-${stamp}.dump`);
	const productionBackup = path.join(backupDir, `classroom-rental-production-before-restore-${stamp}.dump`);

	console.log(`\n▶ Backup DB local → ${localBackup}`);
	runWithFileOutput("docker", [
		"compose", "exec", "-T", "postgres", "pg_dump",
		"-U", localUser, "-d", localDatabase,
		"--format=custom", "--no-owner", "--no-privileges",
	], localBackup);
	if (statSync(localBackup).size === 0) {
		throw new Error("Backup local rỗng; dừng trước khi đụng tới Production.");
	}

	const passFile = path.join(temporaryDir, ".pgpass");
	writeFileSync(passFile, `${[
		escapePgPass(production.host),
		escapePgPass(production.port),
		escapePgPass(production.database),
		escapePgPass(production.username),
		escapePgPass(production.password),
	].join(":")}\n`, { mode: 0o600 });
	chmodSync(passFile, 0o600);

	console.log(`\n▶ Backup Neon Production trước khi thay thế → ${productionBackup}`);
	runWithFileOutput("docker", postgresClientArgs(passFile, "pg_dump", [
		...pgArgs(production),
		"--format=custom", "--no-owner", "--no-privileges",
	]), productionBackup);
	if (statSync(productionBackup).size === 0) {
		throw new Error("Backup Production rỗng; dừng, chưa chạy restore.");
	}

	console.log("\n▶ Restore backup local lên Neon Production (thay thế dữ liệu đích)");
	try {
		runWithFileInput("docker", postgresClientArgs(passFile, "pg_restore", [
			...pgArgs(production),
			"--clean", "--if-exists", "--exit-on-error", "--no-owner", "--no-privileges",
		]), localBackup);
	} catch (restoreError) {
		console.error("✖ Restore local gặp lỗi; đang thử khôi phục Production từ backup vừa tạo.");
		let recoveryError;
		try {
			runWithFileInput("docker", postgresClientArgs(passFile, "pg_restore", [
				...pgArgs(production),
				"--clean", "--if-exists", "--exit-on-error", "--no-owner", "--no-privileges",
			]), productionBackup);
		} catch (error) {
			recoveryError = error;
		}
		if (recoveryError) {
			throw new Error(`Restore local thất bại và khôi phục tự động cũng lỗi. Không xóa backup Production: ${productionBackup}. Cần phục hồi thủ công. Chi tiết restore: ${restoreError instanceof Error ? restoreError.message : "không rõ"}; chi tiết phục hồi: ${recoveryError instanceof Error ? recoveryError.message : "không rõ"}`);
		}
		throw new Error(`Restore local thất bại nhưng Production đã được khôi phục. Backup an toàn: ${productionBackup}. Chi tiết: ${restoreError instanceof Error ? restoreError.message : "lỗi không xác định"}`);
	}

	console.log("\n▶ Xác minh số tài khoản sau restore");
	const userCount = capture("docker", postgresClientArgs(passFile, "psql", [
		...pgArgs(production), "-Atqc", "SELECT count(*) FROM users",
	]));
	console.log(`✓ Số tài khoản trong Production sau restore: ${userCount}`);
	console.log(`✓ Backup local và backup Production được giữ tại: ${backupDir}`);
	console.log("✓ Hoàn tất restore. Chưa deploy lại ứng dụng.");
} catch (error) {
	console.error(`\n✖ Restore dừng: ${error instanceof Error ? error.message : "lỗi không xác định"}`);
	process.exitCode = 1;
} finally {
	cleanup();
}
