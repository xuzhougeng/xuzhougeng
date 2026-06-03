# ============================================================
# Codex Worktree Helpers
#
# Usage:
#   cw
#   cw main codex/my-feature
#   cw origin/main codex/some-task
#
#   cwrm
#   cwrm codex/my-feature
#   cwrm --force codex/my-feature
#   cwrm --yes --force codex/my-feature
#
#   cwls
#
# Optional:
#   export CW_START_CODEX=0
#   export CW_WORKTREE_ROOT=/some/path
# ============================================================

_cw_git_root() {
  git rev-parse --show-toplevel 2>/dev/null
}

_cw_main_worktree() {
  local root="$1"

  git -C "$root" worktree list --porcelain 2>/dev/null | awk '
    /^worktree / {
      print substr($0, 10)
      exit
    }
  '
}

_cw_worktree_for_branch() {
  local admin="$1"
  local branch="$2"

  git -C "$admin" worktree list --porcelain 2>/dev/null | awk -v br="refs/heads/$branch" '
    /^worktree / {
      p = substr($0, 10)
    }
    /^branch / {
      b = substr($0, 8)
      if (b == br) {
        print p
        exit
      }
    }
  '
}

_cw_branch_exists() {
  local admin="$1"
  local branch="$2"

  git -C "$admin" show-ref --verify --quiet "refs/heads/$branch"
}

_cw_branch_reachable_elsewhere() {
  local admin="$1"
  local branch="$2"
  local self_ref="refs/heads/$branch"
  local found

  found=$(
    git -C "$admin" for-each-ref \
      --format='%(refname)' \
      --contains "$self_ref" \
      refs/heads refs/remotes 2>/dev/null | awk -v self="$self_ref" '
        $0 == self {
          next
        }
        $0 ~ /^refs\/remotes\/[^\/]+\/HEAD$/ {
          next
        }
        {
          print
          exit
        }
      '
  )

  [ -n "$found" ]
}

cwls() {
  local root
  root=$(_cw_git_root) || {
    echo "Not inside a git repository."
    return 1
  }

  local admin
  admin=$(_cw_main_worktree "$root")

  if [ -z "$admin" ]; then
    admin="$root"
  fi

  git -C "$admin" worktree list
}

cw() {
  local base="${1:-main}"
  local name="$2"

  local root
  root=$(_cw_git_root) || {
    echo "Not inside a git repository."
    return 1
  }

  local admin
  admin=$(_cw_main_worktree "$root")

  if [ -z "$admin" ]; then
    admin="$root"
  fi

  local repo
  repo=$(basename "$admin")

  if [ -z "$name" ]; then
    name="codex/$(date +%Y%m%d-%H%M%S)"
  fi

  case "$name" in
    codex/*)
      ;;
    *)
      echo "Refusing to create non-codex branch: $name"
      echo "Use a branch name starting with codex/, for example:"
      echo "  cw main codex/my-task"
      return 1
      ;;
  esac

  local safe_name
  safe_name=$(printf "%s" "$name" | sed 's#[/ ]#-#g')

  local wt_parent
  wt_parent="${CW_WORKTREE_ROOT:-$(dirname "$admin")/.worktrees/$repo}"

  local wt_dir="$wt_parent/$safe_name"

  mkdir -p "$wt_parent" || return 1

  echo "Repo:      $admin"
  echo "Base:      $base"
  echo "Branch:    $name"
  echo "Worktree:  $wt_dir"
  echo

  local existing_wt
  existing_wt=$(_cw_worktree_for_branch "$admin" "$name")

  if [ -n "$existing_wt" ] && [ -d "$existing_wt" ]; then
    echo "Worktree already exists:"
    echo "  $existing_wt"
    echo
    cd "$existing_wt" || return 1

    if [ "${CW_START_CODEX:-1}" = "1" ]; then
      echo "Starting Codex..."
      echo
      command -v codex >/dev/null 2>&1 || {
        echo "codex command not found."
        return 127
      }
      codex
    fi

    return 0
  fi

  if [ -e "$wt_dir" ]; then
    echo "Target path already exists:"
    echo "  $wt_dir"
    return 1
  fi

  if git -C "$admin" remote get-url origin >/dev/null 2>&1; then
    git -C "$admin" fetch origin --prune
  fi

  local start_point="$base"

  if git -C "$admin" rev-parse --verify --quiet "$base^{commit}" >/dev/null; then
    start_point="$base"
  elif git -C "$admin" rev-parse --verify --quiet "origin/$base^{commit}" >/dev/null; then
    start_point="origin/$base"
  fi

  if _cw_branch_exists "$admin" "$name"; then
    git -C "$admin" worktree add "$wt_dir" "$name" || return 1
  else
    git -C "$admin" worktree add -b "$name" "$wt_dir" "$start_point" || return 1
  fi

  cd "$wt_dir" || return 1

  echo
  echo "Now in: $(pwd)"
  echo

  if [ "${CW_START_CODEX:-1}" = "1" ]; then
    echo "Starting Codex..."
    echo

    command -v codex >/dev/null 2>&1 || {
      echo "codex command not found."
      return 127
    }

    codex
  fi
}

cwrm() {
  local force=0
  local yes=0
  local target=""

  while [ $# -gt 0 ]; do
    case "$1" in
      -f|--force)
        force=1
        ;;
      -y|--yes)
        yes=1
        ;;
      -h|--help)
        echo "Usage:"
        echo "  cwrm"
        echo "  cwrm codex/branch-name"
        echo "  cwrm /path/to/worktree"
        echo "  cwrm --force codex/branch-name"
        echo "  cwrm --yes --force codex/branch-name"
        return 0
        ;;
      *)
        target="$1"
        ;;
    esac
    shift
  done

  local root=""

  if [ -n "$target" ] && [ -d "$target" ]; then
    root=$(cd "$target" && git rev-parse --show-toplevel 2>/dev/null) || {
      echo "Target path is not a git worktree:"
      echo "  $target"
      return 1
    }
  else
    root=$(_cw_git_root) || {
      echo "Not inside a git repository."
      return 1
    }
  fi

  local admin
  admin=$(_cw_main_worktree "$root")

  if [ -z "$admin" ]; then
    admin="$root"
  fi

  local wt=""
  local branch=""

  if [ -z "$target" ]; then
    wt="$root"
    branch=$(git -C "$wt" branch --show-current)
  elif [ -d "$target" ]; then
    wt=$(cd "$target" && git rev-parse --show-toplevel 2>/dev/null) || {
      echo "Target path is not a git worktree:"
      echo "  $target"
      return 1
    }
    branch=$(git -C "$wt" branch --show-current)
  else
    branch="$target"
    wt=$(_cw_worktree_for_branch "$admin" "$branch")
  fi

  if [ -z "$branch" ]; then
    echo "Cannot detect branch. Detached HEAD worktrees are not supported by cwrm."
    return 1
  fi

  case "$branch" in
    codex/*)
      ;;
    *)
      echo "Refusing to delete non-codex branch:"
      echo "  $branch"
      echo
      echo "This function only deletes branches starting with codex/."
      return 1
      ;;
  esac

  if ! _cw_branch_exists "$admin" "$branch"; then
    echo "Local branch does not exist:"
    echo "  $branch"
    return 1
  fi

  if [ -n "$wt" ] && [ -d "$wt" ]; then
    if [ "$force" -ne 1 ] && [ -n "$(git -C "$wt" status --porcelain)" ]; then
      echo "Worktree has uncommitted changes:"
      git -C "$wt" status --short
      echo
      echo "Commit or stash them first, or use:"
      echo "  cwrm --force $branch"
      return 1
    fi
  fi

  if [ "$force" -ne 1 ]; then
    if ! _cw_branch_reachable_elsewhere "$admin" "$branch"; then
      echo "Branch tip is not reachable from another local or remote ref:"
      echo "  $branch"
      echo
      echo "This usually means the branch has commits that are not merged or preserved elsewhere."
      echo "To delete anyway, use:"
      echo "  cwrm --force $branch"
      return 1
    fi
  fi

  echo "Repo:      $admin"
  echo "Worktree:  ${wt:-<none found>}"
  echo "Branch:    $branch"
  echo "Force:     $force"
  echo

  if [ "$yes" -ne 1 ]; then
    printf "Remove this worktree and delete the local branch? [y/N] "
    IFS= read -r ans

    case "$ans" in
      y|Y|yes|YES)
        ;;
      *)
        echo "Canceled."
        return 1
        ;;
    esac
  fi

  if [ -n "$wt" ] && [ -d "$wt" ]; then
    local here
    here=$(pwd -P)

    local wt_real
    wt_real=$(cd "$wt" && pwd -P)

    case "$here/" in
      "$wt_real"/*)
        cd "$(dirname "$wt_real")" || return 1
        ;;
    esac

    if [ "$force" -eq 1 ]; then
      git -C "$admin" worktree remove --force "$wt_real" || return 1
    else
      git -C "$admin" worktree remove "$wt_real" || return 1
    fi
  fi

  git -C "$admin" branch -D "$branch" || return 1
  git -C "$admin" worktree prune

  echo
  echo "Removed:"
  echo "  branch:   $branch"

  if [ -n "$wt" ]; then
    echo "  worktree: $wt"
  fi
}
