#!/bin/sh
set -eu

repo="${GITTY_REPO:-creative-owl/gitty}"
version="${GITTY_VERSION:-latest}"
install_dir="${GITTY_INSTALL_DIR:-$HOME/.local/bin}"

usage() {
  cat <<'USAGE'
Usage:
  install.sh [--version <version>] [--prefix <dir>] [--install-dir <dir>]

Options:
  --version <version>    Install a specific Gitty version, such as 0.1.0 or v0.1.0.
  --prefix <dir>         Install into <dir>/bin.
  --install-dir <dir>    Install directly into <dir>.
  -h, --help             Show this help text.

Environment:
  GITTY_VERSION          Version to install. Defaults to latest.
  GITTY_INSTALL_DIR      Directory for the gitty binary. Defaults to ~/.local/bin.
  GITTY_REPO             GitHub repository. Defaults to creative-owl/gitty.
USAGE
}

error() {
  printf 'gitty install: %s\n' "$1" >&2
  exit 1
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --version)
      [ "$#" -ge 2 ] || error "--version requires a value"
      version="$2"
      shift 2
      ;;
    --version=*)
      version="${1#--version=}"
      shift
      ;;
    --prefix)
      [ "$#" -ge 2 ] || error "--prefix requires a directory"
      install_dir="${2%/}/bin"
      shift 2
      ;;
    --prefix=*)
      prefix="${1#--prefix=}"
      install_dir="${prefix%/}/bin"
      shift
      ;;
    --install-dir)
      [ "$#" -ge 2 ] || error "--install-dir requires a directory"
      install_dir="${2%/}"
      shift 2
      ;;
    --install-dir=*)
      install_dir="${1#--install-dir=}"
      install_dir="${install_dir%/}"
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      error "unknown option: $1"
      ;;
  esac
done

case "$(uname -s)" in
  Darwin)
    os="darwin"
    ;;
  Linux)
    os="linux"
    ;;
  *)
    error "unsupported operating system: $(uname -s)"
    ;;
esac

case "$(uname -m)" in
  arm64 | aarch64)
    arch="arm64"
    ;;
  x86_64 | amd64)
    arch="x64"
    ;;
  *)
    error "unsupported CPU architecture: $(uname -m)"
    ;;
esac

download() {
  url="$1"
  destination="$2"

  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url" -o "$destination"
    return
  fi

  if command -v wget >/dev/null 2>&1; then
    wget -qO "$destination" "$url"
    return
  fi

  error "curl or wget is required"
}

verify_checksum() {
  archive="$1"
  checksum_file="$2"
  checksum_name="$(basename "$checksum_file")"

  if command -v sha256sum >/dev/null 2>&1; then
    (cd "$(dirname "$archive")" && sha256sum -c "$checksum_name")
    return
  fi

  if command -v shasum >/dev/null 2>&1; then
    (cd "$(dirname "$archive")" && shasum -a 256 -c "$checksum_name")
    return
  fi

  error "sha256sum or shasum is required"
}

target="${os}-${arch}"
archive_name="gitty-${target}.tar.gz"

if [ "$version" = "latest" ]; then
  base_url="https://github.com/${repo}/releases/latest/download"
else
  case "$version" in
    v*)
      tag="$version"
      ;;
    *)
      tag="v${version}"
      ;;
  esac
  base_url="https://github.com/${repo}/releases/download/${tag}"
fi

tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/gitty.XXXXXX")"
trap 'rm -rf "$tmp_dir"' EXIT INT TERM

archive_path="${tmp_dir}/${archive_name}"
checksum_path="${archive_path}.sha256"

download "${base_url}/${archive_name}" "$archive_path"
download "${base_url}/${archive_name}.sha256" "$checksum_path"
verify_checksum "$archive_path" "$checksum_path"

tar -xzf "$archive_path" -C "$tmp_dir"
[ -f "${tmp_dir}/gitty" ] || error "release archive did not contain a gitty binary"

mkdir -p "$install_dir"
chmod 0755 "${tmp_dir}/gitty"
mv "${tmp_dir}/gitty" "${install_dir}/gitty"

printf 'Installed gitty to %s\n' "${install_dir}/gitty"

case ":$PATH:" in
  *":$install_dir:"*) ;;
  *)
    printf 'Add %s to your PATH to run gitty from any directory.\n' "$install_dir"
    ;;
esac

