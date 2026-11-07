#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

STEP="Khởi tạo"
trap 'code=$?; printf "\n✖ Thất bại tại bước: %s (mã %s)\n" "$STEP" "$code"; exit "$code"' ERR

section() {
	STEP="$1"
	printf "\n▶ %s\n" "$STEP"
}

if [[ "${1:-}" != "DEPLOY CODE" ]]; then
	printf "Cần xác nhận bằng cách nhập DEPLOY CODE. Đã dừng, chưa thực hiện thao tác nào.\n" >&2
	exit 2
fi

if [[ ! -t 0 ]]; then
	printf "Cần chạy script trong terminal tương tác để chọn có backup database hay không.\n" >&2
	exit 2
fi

while true; do
	read -r -p "Tạo backup Neon Production trước khi deploy? [Y/n] " backup_answer
	case "${backup_answer,,}" in
		""|y|yes)
			create_backup=true
			break
			;;
		n|no)
			create_backup=false
			break
			;;
		*)
			printf "Vui lòng nhập y hoặc n.\n" >&2
			;;
	esac
done

printf "\n=== BUILD CODE · DEPLOY VERCEL PRODUCTION ===\n"

section "Xác thực tài khoản Vercel"
if ! npx vercel whoami; then
	printf "Chưa đăng nhập. Vercel CLI sẽ yêu cầu bạn xác thực trong terminal/trình duyệt.\n"
	npx vercel login
	npx vercel whoami
fi

section "Build kiểm tra"
npm run build

if [[ "$create_backup" == true ]]; then
	section "Sao lưu Neon Production trước migration"
	umask 077
	backup_dir="${EDU_DB_BACKUP_DIR:-$HOME/.local/share/edu/backups}"
	mkdir -p "$backup_dir"
	chmod 700 "$backup_dir"
	temp_dir="$(mktemp -d)"
	chmod 700 "$temp_dir"
	trap 'rm -rf -- "$temp_dir"' EXIT
	pass_file="$temp_dir/.pgpass"
	pg_env_file="$temp_dir/pg.env"
	backup_file="$backup_dir/classroom-rental-neon-production-$(date +%Y%m%d-%H%M%S).dump"

	# Vercel injects the production secret into this short-lived process. Only
	# connection metadata and a mode-600 pgpass file are written to the temp dir.
	npx vercel env run -e production --scope trinhan --project edu -- node -e '
const fs = require("node:fs");
const path = require("node:path");
const dir = process.argv[1];
const raw = process.env.DATABASE_URL_UNPOOLED;
if (!raw) throw new Error("Thiếu DATABASE_URL_UNPOOLED trong môi trường Production của Vercel.");
const url = new URL(raw);
if (!url.hostname.endsWith(".neon.tech") || url.hostname.includes("-pooler.")) {
  throw new Error("DATABASE_URL_UNPOOLED không phải endpoint Neon direct/non-pooled.");
}
const database = decodeURIComponent(url.pathname.slice(1));
const username = decodeURIComponent(url.username);
const password = decodeURIComponent(url.password);
if (!database || !username || !password) throw new Error("DATABASE_URL_UNPOOLED thiếu thông tin kết nối cần thiết.");
const safeEnv = [url.hostname, url.port || "5432", database, username];
if (safeEnv.some((value) => /[\r\n]/.test(value))) throw new Error("Thông tin kết nối Neon không hợp lệ.");
const escapePgPass = (value) => value.replaceAll("\\", "\\\\").replaceAll(":", "\\:").replaceAll("\n", "\\n");
const passFile = path.join(dir, ".pgpass");
const passLine = [url.hostname, url.port || "5432", database, username, password].map(escapePgPass).join(":");
fs.writeFileSync(passFile, passLine + "\n", { mode: 0o600 });
fs.chmodSync(passFile, 0o600);
const pgEnv = ["PGHOST=" + url.hostname, "PGPORT=" + (url.port || "5432"), "PGDATABASE=" + database, "PGUSER=" + username].join("\n");
fs.writeFileSync(path.join(dir, "pg.env"), pgEnv + "\n", { mode: 0o600 });
' "$temp_dir"

	docker run --rm postgres:18-alpine pg_dump --version
	if ! docker run --rm -i \
		-v "$pass_file:/run/secrets/edu-pgpass:ro" \
		--env-file "$pg_env_file" \
		-e PGPASSFILE=/run/secrets/edu-pgpass \
		-e PGSSLMODE=require \
		postgres:18-alpine pg_dump --no-password --format=custom --no-owner --no-privileges > "$backup_file"; then
		rm -f "$backup_file"
		printf "Không tạo được backup Neon Production; dừng trước khi chạy migration.\n" >&2
		exit 1
	fi
	chmod 600 "$backup_file"
	if [[ ! -s "$backup_file" ]]; then
		rm -f "$backup_file"
		printf "Backup Neon Production rỗng; dừng trước khi chạy migration.\n" >&2
		exit 1
	fi
	printf "✓ Backup Neon Production đã lưu: %s\n" "$backup_file"
else
	printf "\n⚠ Đã chọn bỏ qua backup database. Migration sẽ chạy trực tiếp trên Neon Production.\n"
fi

section "Áp dụng migration lên Neon Production"
npx vercel env run -e production --scope trinhan --project edu -- bash -c '
	if [[ -z "${DATABASE_URL_UNPOOLED:-}" ]]; then
		printf "Thiếu DATABASE_URL_UNPOOLED trong môi trường Production của Vercel. Cần cấu hình direct connection string của Neon.\n" >&2
		exit 1
	fi
	DATABASE_URL="$DATABASE_URL_UNPOOLED" npx prisma migrate deploy
'

section "Deploy code hiện tại lên Vercel Production"
npx vercel --scope trinhan --project edu --prod

if [[ "$create_backup" == true ]]; then
	printf "\n✓ Backup, migration và deploy hoàn tất. Không commit/push.\n"
else
	printf "\n✓ Migration và deploy hoàn tất (đã bỏ qua backup database). Không commit/push.\n"
fi
