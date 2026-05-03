#!/usr/bin/env bash
# =============================================================================
# check_secrets.sh — Scan for hardcoded credentials before committing
#
# Run manually or as a pre-commit hook:
#   bash scripts/check_secrets.sh          # scan working tree
#   bash scripts/check_secrets.sh --staged # scan staged files only
#
# Returns exit code 1 if any pattern matches (use in CI to fail the pipeline).
# =============================================================================
set -euo pipefail

STAGED=false
[[ "${1:-}" == "--staged" ]] && STAGED=true

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; RESET='\033[0m'

FOUND=0

scan() {
    local label="$1"; shift
    local pattern="$1"; shift
    local extra_args=("$@")

    if [ "$STAGED" = "true" ]; then
        # Scan only staged content
        matches=$(git diff --cached --unified=0 | grep '^\+' \
                  | grep -E "$pattern" || true)
    else
        matches=$(grep -rn --include="*.py" --include="*.ts" --include="*.tsx" \
                           --include="*.js" --include="*.yml" \
                           --include="*.yaml" --include="*.json" --include="*.sh" \
                  -E "$pattern" \
                  --exclude-dir=".git" \
                  --exclude-dir="node_modules" \
                  --exclude-dir=".venv" \
                  --exclude-dir="venv" \
                  --exclude-dir="docs" \
                  --exclude="*.example" \
                  --exclude="*.env" \
                  --exclude="check_secrets.sh" \
                  . "${extra_args[@]}" 2>/dev/null || true)
    fi

    if [ -n "$matches" ]; then
        echo -e "${RED}✗ POSSIBLE SECRET: ${label}${RESET}"
        echo "$matches" | head -10
        echo ""
        FOUND=$((FOUND + 1))
    fi
}

echo "Scanning for hardcoded credentials…"
echo ""

# AWS access key IDs
scan "AWS Access Key"          'AKIA[0-9A-Z]{16}'

# AWS secret access keys (40 hex-like chars after a key name)
scan "AWS Secret Key"          '(aws_secret|AWS_SECRET)[^=]*=\s*[A-Za-z0-9/+=]{40}'

# Private key headers (PEM files checked in by accident)
scan "Private Key (PEM)"       '-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----'

# Hardcoded password assignments
scan "Hardcoded password"      '(password|passwd|pwd)\s*=\s*["\x27][^"\x27$\{]{8,}'

# Hardcoded secret_key assignments (anything that isn't a variable reference)
scan "Hardcoded SECRET_KEY"    "SECRET_KEY\s*=\s*['\"][^'\"\$\{]{16,}"

# Gmail app passwords (16 lowercase letters with optional spaces)
scan "Gmail App Password"      'GMAIL_PASSWORD\s*=\s*[a-z]{4}(\s[a-z]{4}){3}'

# Hugging Face tokens
scan "HuggingFace Token"       'hf_[A-Za-z0-9]{30,}'

# Generic API keys pattern (KEY= followed by a long alphanumeric string)
scan "Generic API Key"         "(API_KEY|api_key)\s*[=:]\s*['\"]?[A-Za-z0-9_\-]{20,}"

# .pem file path references committed to source
scan ".pem file reference"     '\.pem["\x27\s]'

# Explicit "TODO: replace" left in secrets (common oversight)
scan "TODO in secret value"    '(SECRET|PASSWORD|API_KEY).*TODO'

# ── Summary ───────────────────────────────────────────────────────────────────
echo "─────────────────────────────────────"
if [ "$FOUND" -eq 0 ]; then
    echo -e "${GREEN}✓ No secrets detected.${RESET}"
    exit 0
else
    echo -e "${YELLOW}⚠  $FOUND pattern(s) matched. Review each match above.${RESET}"
    echo ""
    echo "If a match is a false positive, add a '# nosec' comment on that line"
    echo "or exclude the file by editing the scan() calls in this script."
    exit 1
fi
