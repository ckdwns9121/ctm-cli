# ctm — Colo Ticket Manager

Jira 티켓 기반 Git 브랜치 관리 CLI.  
이슈 조회 → 브랜치 생성 → PR 생성까지 터미널에서 한 번에.

---

## 설치

### Homebrew (macOS)

```bash
brew tap ckdwns9121/ctm
brew install ctm
```

업데이트:

```bash
brew upgrade ctm
```

### npm (Windows / Linux / macOS)

```bash
npm install -g @devchangjun/ctm
```

---

## 시작하기

최초 1회 설정이 필요합니다.

```bash
ctm init
```

아래 정보를 순서대로 입력합니다.

| 항목 | 설명 |
|---|---|
| Jira base URL | `https://yourcompany.atlassian.net` |
| Jira email | Atlassian 계정 이메일 |
| Jira API token | [토큰 발급](https://id.atlassian.com/manage-profile/security/api-tokens) |
| 기본 프로젝트 | 목록에서 선택 |
| Base branch | `main` (기본값) |

설정은 `~/.config/ctm/config.json`에 저장됩니다.

---

## 명령어

### `ctm ls` — 내 이슈 목록

```bash
ctm ls               # 기본 프로젝트의 담당 이슈
ctm ls --all         # 전체 프로젝트
ctm ls --status "In Progress"
ctm ls --project CGKR
```

상태별로 그룹화하여 출력합니다.

```
In Progress
  🔴 CGKR-1423    로그인 페이지 버그 수정                        [Bug]
  🟡 CGKR-1401    마이페이지 UI 개선                             [Story]

To Do
  🟢 CGKR-1388    회원가입 이메일 인증 추가                      [Task]
```

---

### `ctm start [key]` — 브랜치 생성

```bash
ctm start            # 인터랙티브 이슈 선택
ctm start CGKR-1423  # 특정 이슈 바로 시작
ctm start 1423       # 숫자만 입력해도 OK (기본 프로젝트 자동 적용)
```

1. 이슈를 선택하면 브랜치 타입을 고릅니다: `feat` / `fix` / `refactor` / `qa` / `chore`
2. Jira 이슈 타입에 따라 자동으로 타입을 추천합니다 (Bug → `fix`, Story → `feat` 등)
3. 브랜치명을 확인 후 체크아웃

```
Branch type  › fix
Branch name  › fix/CGKR-1423   (수정 가능)

✓ Switched to fix/CGKR-1423
✓ Jira status → In Progress
```

현재 브랜치에 uncommitted 변경사항이 있으면 stash 여부를 물어봅니다.

---

### `ctm co [key]` — 브랜치 체크아웃

```bash
ctm co CGKR-1423     # 해당 티켓의 브랜치로 체크아웃
ctm co 1423           # 숫자만 입력해도 OK
```

같은 티켓으로 여러 브랜치가 있으면 선택 리스트가 나옵니다.

```
? Multiple branches found for CGKR-1423:
❯ feat/CGKR-1423
  fix/CGKR-1423
  refactor/CGKR-1423
```

uncommitted 변경사항이 있으면 stash 여부를 물어보고, stash를 거부하면 체크아웃을 중단합니다.

---

### `ctm st` — 현재 상태 확인

```bash
ctm st
```

현재 브랜치에 연결된 Jira 이슈 정보와 변경 현황을 출력합니다.

```
Branch:   fix/CGKR-1423
Ticket:   CGKR-1423 — 로그인 페이지 버그 수정
Status:   In Progress
Priority: 🔴 High
URL:      https://yourcompany.atlassian.net/browse/CGKR-1423

Changes:  3 file(s)  +42  -7
```

---

### `ctm done [key]` — PR 생성

```bash
ctm done             # 현재 브랜치 기준으로 자동 감지
ctm done CGKR-1423   # 명시적 지정
```

1. 현재 브랜치를 push
2. GitHub PR 생성 (`.github/pull_request_template.md`가 있으면 자동 적용)
3. Jira 이슈에 PR URL 코멘트 추가

> **사전 요구사항**: GitHub CLI(`gh`)가 설치되고 인증되어 있어야 합니다.
> ```bash
> brew install gh
> gh auth login
> ```

---

### `ctm clean [key]` — 브런치 정리

```bash
ctm clean            # 현재 브런치 삭제
ctm clean CGKR-1423  # 해당 이슈 브런치 삭제
```

로컬 브랜치를 삭제하고, 원격 브랜치도 함께 삭제할지 물어봅니다.  
현재 브랜치를 삭제할 경우 base branch로 자동 전환됩니다.  
worktree가 연결되어 있으면 함께 제거할지 자동으로 물어봅니다.

---

### `ctm wt` — worktree 관리

```bash
ctm wt                       # 현재 레포의 worktree 목록
ctm wt rm CGKR-1423          # worktree 제거 (브런치 유지)
ctm wt rm CGKR-1423 --branch # worktree + 브런치 함께 삭제
ctm wt rm CGKR-1423 --force  # 변경사항이 있어도 강제 제거
```

```
  PATH                                        BRANCH              HEAD
  /Users/dev/my-app  (main)                  main                abc1234
  /Users/dev/my-app--feat-CGKR-1423          feat/CGKR-1423      def5678
```

---
## 일반적인 워크플로우

### 브런치 모드 (simpler)

```bash
ctm ls                  # 내 이슈 확인
ctm start CGKR-1423     # 브런치 생성 + Jira 'In Progress'
ctm st                  # 현재 상태 확인
ctm done                # push + PR 생성
ctm clean               # 머지 후 브런치 정리
```

### worktree 모드 (병렬 작업)

```bash
ctm ls                           # 내 이슈 확인
ctm start CGKR-1423 --worktree   # 별도 디렉토리 생성, 브런치 전환 없음
cd /path/to/my-app--feat-CGKR-1423
ctm done                         # 해당 worktree에서 push + PR
ctm wt rm CGKR-1423              # 머지 후 worktree 정리
```

---

## 브랜치 네이밍 규칙

```
{type}/{ISSUE-KEY}
```

| 타입 | 용도 |
|---|---|
| `feat` | 신규 기능, Story, Feature |
| `fix` | 버그 수정 |
| `refactor` | 리팩토링 |
| `qa` | QA, 테스트 |
| `chore` | 기타 작업, Task, Epic |

예: `feat/CGKR-1423`, `fix/CGKR-1388`

---

## 요구사항

- macOS / Windows / Linux (npm 설치 시)
- Node.js 20+ (npm 설치 시)
- Git
- GitHub CLI (`gh`) — `ctm done` 사용 시 필요

---

## 설정 파일

```
~/.config/ctm/config.json
```

`ctm init`으로 재설정하면 덮어씁니다.
