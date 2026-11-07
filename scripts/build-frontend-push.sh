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

printf "\n=== BUILD FRONTEND · PUSH ===\n"

section "Kiểm tra thay đổi"
dirty_files="$(git status --porcelain --untracked-files=all | awk '
	substr($0, 4) != ".vscode/tasks.json" &&
	substr($0, 4) != "scripts/deploy-production.sh" &&
	substr($0, 4) != "scripts/build-frontend-push.sh" { print }
')"
if [[ -n "$dirty_files" ]]; then
	printf "Còn thay đổi cần commit hoặc stash trước khi build/push:\n%s\n" "$dirty_files" >&2
	exit 1
fi

section "Build frontend"
npm run build

section "Đẩy commit lên Git remote"
git push

printf "\n✓ Build và push hoàn tất.\n"
