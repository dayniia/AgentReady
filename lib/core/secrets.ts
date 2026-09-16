const REDACTED = "[REDACTED]";

const PEM_BLOCK =
  /-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g;

const GOOGLE_API_KEY = /\bAIza[0-9A-Za-z\-_]{20,}/g;
const OPENAI_STYLE_KEY = /\bsk-[A-Za-z0-9]{20,}/g;
const GITHUB_TOKEN = /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}/g;
const GITHUB_PAT = /\bgithub_pat_[A-Za-z0-9_]{20,}/g;
const AWS_ACCESS_KEY = /\bAKIA[0-9A-Z]{16}\b/g;
const BEARER_TOKEN = /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi;

const ASSIGNED_SECRET =
  /\b((?:[A-Za-z_][A-Za-z0-9_]*)?(?:api[_-]?key|secret|token|password|passwd))\s*([:=])\s*(['"])[^'"]*\3/gi;

const ENV_SECRET_LINE =
  /^([A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|PASSWD|PASS))\s*=\s*.+$/gm;

export function stripSecrets(content: string): string {
  return content
    .replace(PEM_BLOCK, REDACTED)
    .replace(GOOGLE_API_KEY, REDACTED)
    .replace(OPENAI_STYLE_KEY, REDACTED)
    .replace(GITHUB_TOKEN, REDACTED)
    .replace(GITHUB_PAT, REDACTED)
    .replace(AWS_ACCESS_KEY, REDACTED)
    .replace(BEARER_TOKEN, `Bearer ${REDACTED}`)
    .replace(ENV_SECRET_LINE, `$1=${REDACTED}`)
    .replace(ASSIGNED_SECRET, `$1 $2 $3${REDACTED}$3`);
}
