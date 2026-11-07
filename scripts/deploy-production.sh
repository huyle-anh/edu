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

if [[ "${1:-}" != "DEPLOY" ]]; then
	printf "Cần xác nhận bằng cách nhập DEPLOY. Đã dừng, chưa thực hiện thao tác nào.\n" >&2
	exit 2
fi

printf "\n=== BACKUP DATABASE · PUSH · VERCEL PRODUCTION ===\n"

section "Xác thực tài khoản Vercel"
if ! npx vercel whoami; then
	printf "Chưa đăng nhập. Vercel CLI sẽ yêu cầu bạn xác thực trong terminal/trình duyệt.\n"
	npx vercel login
	npx vercel whoami
fi

section "Kiểm tra thay đổi"
dirty_files="$(git status --porcelain --untracked-files=all | awk '
	substr($0, 4) != ".vscode/tasks.json" &&
	substr($0, 4) != "scripts/deploy-production.sh" &&
	substr($0, 4) != "scripts/build-frontend-push.sh" { print }
')"
if [[ -n "$dirty_files" ]]; then
	printf "Còn thay đổi cần commit hoặc stash trước khi deploy:\n%s\n" "$dirty_files" >&2
	exit 1
fi

section "Sao lưu database"
backup_dir="${EDU_DB_BACKUP_DIR:-$HOME/.local/share/edu/backups}"
mkdir -p "$backup_dir"
backup_file="$backup_dir/classroom-rental-$(date +%Y%m%d-%H%M%S).dump"
docker compose exec -T postgres sh -ec \
	'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl' \
	> "$backup_file"
test -s "$backup_file"
printf "✓ Backup đã lưu: %s\n" "$backup_file"

section "Đẩy commit lên Git remote"
git push

section "Deploy production lên Vercel"
npx vercel --prod

printf "\n✓ Hoàn tất backup và deploy.\n"
