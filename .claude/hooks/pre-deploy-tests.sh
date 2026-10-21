#!/usr/bin/env bash
# PreToolUse(Bash)：CC 要跑 `wrangler deploy` 之前，先跑 tests/ 的測試表。
# 有紅燈 -> exit 2，CC 會看到下面的訊息，不會部署。純 bash + node，Mac 與 Git Bash 都能跑。
input="$(cat)"
cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // ""' 2>/dev/null)"

# 只攔 wrangler deploy / publish（含 npx wrangler deploy）
if ! printf '%s' "$cmd" | grep -Eq '(^|[[:space:];&|])wrangler[[:space:]]+(deploy|publish)([[:space:]]|$)'; then
  exit 0
fi

root="${CLAUDE_PROJECT_DIR:-$PWD}"
# 這門課的東西（tests/、scenario/、部署閘）都在 course/ 底下；根目錄只放 Claude 的 harness
proj="$root"; [ -d "$root/course" ] && proj="$root/course"

# 測試閘是 run-tests skill 建立 .ax303-gate 之後才開；沒開之前（序幕手工貼、第二幕以前）部署不受影響。
# .ax303-gate 的內容是「已經蓋好的工位」，逗號分隔（例：service,intake）；空的＝五個工位都算。
if [ ! -f "$proj/.ax303-gate" ]; then
  exit 0
fi
stations="$(tr -d ' \n\r' < "$proj/.ax303-gate")"

echo "[ax303] 部署前測試閘：先跑 course/tests/ 測試表..." >&2
out="$(node "$root/.claude/scripts/run-tests.mjs" --dir "$proj" ${stations:+--stations "$stations"} 2>&1)"
code=$?
if [ $code -eq 0 ]; then
  printf '%s\n' "$out" >&2
  exit 0
fi
{
  printf '%s\n' "$out"
  echo
  echo "[ax303] 還有測試是紅燈，不部署。請先找出是哪一格出問題（見 course/logs/ 最新一份），修好、重跑到全綠再部署。"
  echo "[ax303] 若是『連不上本機服務』：先在 course/ 裡另開一個視窗跑 wrangler dev，再重試。"
} >&2
exit 2
