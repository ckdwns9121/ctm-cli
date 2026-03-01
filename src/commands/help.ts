import chalk from "chalk";

// ── Types ──────────────────────────────────────────────────────────────────

interface CommandDef {
  name: string;
  aliases?: string[];
  usage: string;
  description: string;
  options?: { flag: string; desc: string }[];
  examples: { cmd: string; comment: string }[];
}

// ── Command definitions ────────────────────────────────────────────────────

const COMMANDS: CommandDef[] = [
  {
    name: "init",
    usage: "ctm init",
    description: "Jira 연결 정보를 설정합니다. 최초 1회 실행이 필요합니다.",
    examples: [
      { cmd: "ctm init", comment: "대화형 설정 시작" },
    ],
  },
  {
    name: "issues",
    aliases: ["ls"],
    usage: "ctm ls [options]",
    description: "내 Jira 이슈 목록을 상태별로 출력합니다.",
    options: [
      { flag: "-a, --all", desc: "전체 프로젝트의 이슈 조회" },
      { flag: "-s, --status <status>", desc: "특정 상태로 필터 (예: 'In Progress')" },
      { flag: "-p, --project <key>", desc: "특정 프로젝트 키로 필터" },
    ],
    examples: [
      { cmd: "ctm ls", comment: "기본 프로젝트 이슈 목록" },
      { cmd: "ctm ls --all", comment: "전체 프로젝트" },
      { cmd: "ctm ls --status 'In Progress'", comment: "진행 중인 이슈만" },
      { cmd: "ctm ls --project CGKR", comment: "특정 프로젝트" },
    ],
  },
  {
    name: "start",
    usage: "ctm start [key] [-w]",
    description: "Jira 이슈에 대한 브런치를 생성하고 체크아웃합니다.\n  Jira 상태를 'In Progress'로 변경합니다.",
    options: [
      { flag: "-w, --worktree", desc: "별도 디렉토리(worktree)를 생성합니다 (브런치 전환 없이 병렬 작업 가능)" },
    ],
    examples: [
      { cmd: "ctm start", comment: "이슈 목록에서 인터랙티브 선택" },
      { cmd: "ctm start CGKR-1423", comment: "특정 이슈 키로 바로 시작" },
      { cmd: "ctm start 1423 --worktree", comment: "worktree 모드로 발동" },
    ],
  },
  {
    name: "done",
    usage: "ctm done [key]",
    description: "현재 브랜치를 push하고 GitHub PR을 생성합니다.\n  .github/pull_request_template.md 가 있으면 자동으로 PR body에 적용됩니다.\n  gh CLI가 설치·인증되어 있어야 합니다.",
    examples: [
      { cmd: "ctm done", comment: "현재 브랜치 기준 자동 감지" },
      { cmd: "ctm done CGKR-1423", comment: "이슈 키 명시" },
    ],
  },
  {
    name: "status",
    aliases: ["st"],
    usage: "ctm st",
    description: "현재 브랜치와 연결된 Jira 이슈 정보, 변경 현황을 출력합니다.",
    examples: [
      { cmd: "ctm st", comment: "현재 상태 확인" },
    ],
  },
  {
    name: "clean",
    usage: "ctm clean [key]",
    description:
      "Jira 이슈에 연결된 로컈 브런치를 삭제합니다.\n  원격 브런치도 함께 삭제할지 묻어봅니다.\n  worktree가 있으면 함께 정리할지 묻어뽅니다.",
    examples: [
      { cmd: "ctm clean", comment: "현재 브런치 삭제" },
      { cmd: "ctm clean CGKR-1423", comment: "특정 이슈 브런치 삭제" },
      { cmd: "ctm clean 1423", comment: "숫자만 입력 가능" },
    ],
  },
  {
    name: "worktree",
    aliases: ["wt"],
    usage: "ctm wt [rm <key>]",
    description:
      "worktree 목록을 확인하거나 제거합니다.\n  ctm start --worktree로 생성된 worktree를 관리합니다.",
    options: [
      { flag: "-b, --branch", desc: "worktree 제거 시 브런치도 함께 삭제" },
      { flag: "-f, --force", desc: "변경사항이 있어도 강제 제거" },
    ],
    examples: [
      { cmd: "ctm wt", comment: "worktree 목록" },
      { cmd: "ctm wt rm CGKR-1423", comment: "worktree 제거 (브런치 유지)" },
      { cmd: "ctm wt rm 1423 --branch", comment: "worktree + 브런치 함께 삭제" },
    ],
  },
];

// ── Rendering helpers ──────────────────────────────────────────────────────

const DIM_RULE = chalk.dim("─".repeat(56));

function renderHeader(): void {
  console.log();
  console.log(`  ${chalk.bold.cyan("ctm")}  ${chalk.dim("— Colo Ticket Manager")}`);
  console.log(`  ${chalk.dim("Jira 티켓 기반 Git 브랜치 관리 CLI")}`);
  console.log();
}

function renderUsageLine(): void {
  console.log(`  ${chalk.bold("사용법")}  ${chalk.cyan("ctm")} ${chalk.dim("<command>")} ${chalk.dim("[options]")}`);
  console.log();
}

function renderCommandRow(cmd: CommandDef): void {
  const aliases = cmd.aliases?.length ? chalk.dim(` (${cmd.aliases.join(", ")})`) : "";
  const name = chalk.cyan(cmd.name.padEnd(10)) + aliases;
  // One-line description (first sentence only for summary view)
  const shortDesc = cmd.description.split("\n")[0];
  console.log(`  ${name}  ${shortDesc}`);
}

function renderCommandDetail(cmd: CommandDef): void {
  const aliases = cmd.aliases?.length
    ? "  " + chalk.dim(`alias: ${cmd.aliases.join(", ")}`)
    : "";

  console.log();
  console.log(DIM_RULE);
  console.log(`  ${chalk.bold.cyan(cmd.name)}${aliases}`);
  console.log();
  console.log(`  ${chalk.bold("사용법")}   ${chalk.cyan(cmd.usage)}`);
  console.log();

  // Multi-line description
  for (const line of cmd.description.split("\n")) {
    console.log(`  ${line}`);
  }
  console.log();

  if (cmd.options?.length) {
    console.log(`  ${chalk.bold("옵션")}`);
    for (const opt of cmd.options) {
      console.log(`    ${chalk.green(opt.flag.padEnd(26))}  ${opt.desc}`);
    }
    console.log();
  }

  console.log(`  ${chalk.bold("예시")}`);
  for (const ex of cmd.examples) {
    console.log(`    ${chalk.cyan(ex.cmd.padEnd(38))}  ${chalk.dim(ex.comment)}`);
  }
}

function renderWorkflow(): void {
  console.log();
  console.log(`  ${chalk.bold("일반적인 워크플로우")}`);
  console.log();
  const steps = [
    ["ctm init", "최초 1회 — Jira 연결 설정"],
    ["ctm ls", "내 이슈 목록 확인"],
    ["ctm start CGKR-123", "브랜치 생성 + Jira 'In Progress'"],
    ["ctm st", "현재 상태 확인"],
    ["ctm done", "push + GitHub PR 생성"],
    ["ctm clean", "머지 후 브랜치 정리"],
  ];
  for (const [cmd, comment] of steps) {
    console.log(`    ${chalk.cyan(cmd.padEnd(24))}  ${chalk.dim(comment)}`);
  }
  console.log();
}

// ── Export ─────────────────────────────────────────────────────────────────

export function helpCommand(commandName: string | undefined): void {
  if (commandName) {
    const target = COMMANDS.find(
      (c) => c.name === commandName || c.aliases?.includes(commandName),
    );

    if (!target) {
      console.error(
        `${chalk.red("✗")} 알 수 없는 명령어: ${chalk.bold(commandName)}\n`,
      );
      console.log(`  사용 가능한 명령어: ${COMMANDS.map((c) => chalk.cyan(c.name)).join(", ")}`);
      console.log();
      process.exit(1);
    }

    renderHeader();
    renderCommandDetail(target);
    console.log();
    console.log(DIM_RULE);
    console.log();
    return;
  }

  // ── All-commands overview ────────────────────────────────────────────────
  renderHeader();
  renderUsageLine();

  console.log(`  ${chalk.bold("명령어")}`);
  console.log();
  for (const cmd of COMMANDS) {
    renderCommandRow(cmd);
  }

  renderWorkflow();

  console.log(
    `  ${chalk.dim(`자세한 도움말: ${chalk.cyan("ctm help <command>")}`)}`,
  );
  console.log();
}
