<p align="center">
  <img src="assets/branding/hera-hero.png" alt="야경을 배경으로 터미널을 소개하는 오피스룩의 오리지널 애니메이션 코딩 파트너, Hera" width="960">
</p>

<h1 align="center">Hera</h1>
<p align="center"><strong>터미널에서 함께 일하는 당신의 코딩 파트너.</strong></p>
<p align="center"><a href="README.md">English</a> · <strong>한국어</strong> · <a href="README.jp.md">日本語</a></p>
<p align="center"><a href="https://github.com/NotNull92/heraAgent/actions/workflows/ci.yml"><img src="https://github.com/NotNull92/heraAgent/actions/workflows/ci.yml/badge.svg" alt="Windows 및 macOS CI"></a></p>

Hera는 **Windows와 macOS**에서 실행하는 로컬 CLI/TUI 코딩 에이전트입니다.
원하는 변경을 말하면 프로젝트를 읽고, 파일을 수정하고, 검사를 실행한 뒤 같은 대화에서
결과를 설명합니다. **Codex App Server**의 도구·세션·협업 기능을 사용하며,
GPT와 OpenCode Go를 명시적으로 선택해 사용할 수 있습니다.

**개발 프리뷰 · 0.1.0-alpha.1 · 고정 Codex API 런타임 0.161.0.**
소스는 공개되어 있지만 npm 패키지나 GitHub Release는 아직 배포하지 않았습니다.
아래 소스 설치 절차로 시작하세요. Hera는 로컬에서 실행되고, 모델 추론은 사용자의
제공자 계정을 이용합니다. 오프라인 모델 실행기는 아닙니다.

## Hera로 할 수 있는 일

- **수정과 검사를 한 작업에서:** 별도의 `/apply` 단계 없이 파일을 수정하고 테스트합니다.
- **먼저 계획하기:** `/plan`은 읽기 전용으로 계획하고, `/diff`는 실제 Git 변경을 보여줍니다.
- **모델 역할 선택:** HERA 설계(설계·조사)와 HERA 개발(코딩)을 선택합니다.
- **공개 웹 리서치:** 별도 유료 검색 API 없이 로컬 Playwright/Chromium으로 검색하고 페이지를 읽습니다.
- **대화 이어가기:** 네이티브 세션을 재개하며 별도의 Hera 대화 데이터베이스를 만들지 않습니다.
- **터미널에 맞는 조작:** 슬래시 명령 추천, 모델·추론 강도 메뉴, 한국어 입력과 한·영 화면을 제공합니다.

## 빠른 시작

**Git**, **npm이 포함된 Node.js 24.x**, 터미널, 공식 로그인으로 이용할 OpenAI 계정과
OpenCode Go 키가 필요합니다. **두 모드 모두 두 제공자의 설정이 필요합니다.** 각자 본인 계정을 사용하며, 저장소에 인증 정보는 포함되어 있지 않습니다.
실제 모델 사용 가능 여부는 계정에 따라 달라집니다.

CI 대상은 Windows x64와 Apple Silicon macOS입니다. Intel macOS는 미검증입니다.
화면 언어는 한국어와 영어를 지원합니다. 일본어 README는 문서 번역이며 일본어 UI는 아닙니다.

### 1. 소스 받기와 빌드

**Windows — 네이티브 PowerShell:**

```powershell
git clone https://github.com/NotNull92/heraAgent.git
if ($LASTEXITCODE -ne 0) { throw 'Clone failed' }
Set-Location heraAgent
npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw 'Install failed' }
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
node bin/hera.mjs --version
```

**macOS — 터미널:**

```sh
git clone https://github.com/NotNull92/heraAgent.git
cd heraAgent
npm ci
npm run build
node bin/hera.mjs --version
```

다른 도구가 이미 `hera` 명령을 사용하고 있어도 위처럼 경로를 지정해 실행하면 충돌을 피할 수
있습니다. Hera의 프로젝트 전용 런타임은 전역 Codex 설치를 교체하지 않습니다.

### 2. 로그인하고 모델 선택하기

복제한 저장소 디렉터리에서 실행합니다. 두 운영체제에서 동일합니다.

```text
node bin/hera.mjs auth login openai
node bin/hera.mjs auth login go
node bin/hera.mjs init --list-models
node bin/hera.mjs init --model "YOUR_MODEL_ID" --language ko
```

`YOUR_MODEL_ID`를 조회 결과에 나온 정확한 모델 ID로 바꾸세요. 추론 강도는 선택한 모델이 지원하는
값이어야 합니다. 목록에 표시된다고 계정의 사용 권한까지 보장되지는 않습니다.
OpenAI 로그인에는 `--device`를 사용할 수 있습니다. Go 키는 가려서 입력하고 OS 키링에 저장합니다.

**Windows에서만:** Hera의 분리된 프로필에 공식 샌드박스를 설정합니다.

```text
node bin/hera.mjs sandbox setup
```

### 3. 상태 확인 후 시작하기

```text
node bin/hera.mjs doctor --json
node bin/hera.mjs --cwd "PATH_TO_YOUR_PROJECT" --single-agent
```

프로젝트 경로를 실제 존재하는 디렉터리로 바꾸세요. 처음에는 워커를 명시적으로 끄는
기본 모드인 HERA 설계의 싱글 에이전트로 시작합니다. 제공자 설정이 빠졌다면 설정 메뉴가 열립니다.
파일 수정은 네이티브 작업공간 샌드박스를 사용하며, 추가 권한은 한 번 허용하거나 거부할 수
있습니다. 제한 없는 실행 모드로 자동 전환하지 않습니다.

여러 줄 요청이나 비대화형 실행:

```text
node bin/hera.mjs --cwd "PATH_TO_YOUR_PROJECT" run --single-agent --prompt-file "request.txt"
```

요청 파일이 실행 디렉터리 밖에 있다면 절대 경로를 사용하세요.
비대화형 실행에서는 대화형 권한 요청을 거부합니다.

## 모드 선택

| 모드 | 메인 작업 | 위임 작업 |
| --- | --- | --- |
| HERA 개발 (`external_workers`) | 선택한 GPT 모델 | OpenCode Go · DeepSeek V4.1 Flash |
| HERA 설계 (`adaptive`, 기본값) | OpenCode Go · DeepSeek V4.1 Flash | 어려운 추론·계획·설계는 선택한 GPT/Astra 역할 |

`/mode`로 선택합니다. **워커는 로컬 검증이 필요합니다.** 런타임, 관련 코드, 플랫폼, 모델,
제공자, 권한, 동시 실행 수가 검증 기록과 일치해야 하며 변경하면 기록이 무효화됩니다.
두 모드는 검토된 네이티브 런타임을 Hera 홈에 별도로 설치해야 합니다.
키를 저장하는 것만으로 활성화되지 않으며, 실패 시 다른 제공자로 자동 전환하지 않습니다.

adaptive에서 `/model main`과 `/effort main`은 GPT 추론 역할을 설정합니다.
새 대화는 짧은 공통 지침으로 시작합니다. **HERA 개발만 코딩할 때 전체 코딩 지침을
불러옵니다. HERA 설계는 설계·조사 지침만 사용하며 코딩 지침 요청을 차단합니다.**
지침은 웹 접속 없이 로컬에서 읽습니다. 이 구분은 지침 범위이며 샌드박스 권한 변경은 아닙니다.
기존 대화 이력은 삭제하지 않으므로 새 범위는 새 세션에서 사용하세요.

GPT 밸런스는 제거되었습니다. 기존 `gpt_only` 설정과 이력은 보존하지만 작업 실행은 차단합니다.
`/mode` 또는 `hera init --mode adaptive`(설계) / `hera init --mode external_workers`(개발)로
직접 선택하세요. 다른 제공자 경로로 자동 변경하지 않습니다.

현재 개발 체크아웃은 `/effort worker`에서 Go의 `low`, `high`, `max`를 제공하며,
유효한 추론 강도 변경은 v2 검증을 유지합니다. GPT 선택지는 모델 카탈로그를 따릅니다.
`/workers`는 프로젝트 제한 내에서 1–8의 동시 실행 상한을 설정하며 실제 실행 수를 나타내지 않습니다.
설정은 다음 입력의 새 네이티브 세션부터 적용되며 Hera를 재시작할 필요가 없습니다.
작업 진행 중에는 변경할 수 없고, 이전 v1 검증 기록은 새 검증이 필요합니다.

[네이티브 런타임 설치·검증](experiments/codex-provider-routing/README.md)과
[호환성](docs/compatibility.md)을 참고하세요. 개발자의 검증 결과가 다른 PC의 기능을
자동으로 활성화하지 않습니다. 인증 정보나 승인 기록을 복사해 검사를 우회하지 마세요.

## 명령어와 키

`/`를 입력하면 추천 목록이 나옵니다. 이어서 입력해 필터링하고, 위/아래로 선택,
Tab으로 완성, Enter로 실행, Escape로 닫습니다. **명령어는 `/`로만 시작합니다.**
맨 앞의 백슬래시는 일반 텍스트이며, 붙여 넣은 명령도 텍스트로 처리합니다.

| 명령 | 용도 |
| --- | --- |
| `/help` | 명령 도움말 |
| `/model`, `/effort`, `/workers` | 모델·추론 강도·워커 상한 메뉴 |
| `/mode`, `/providers` | 에이전트 모드와 제공자 로그인 |
| `/research` | 리서치 설정·상태·CAPTCHA 제어 |
| `/plan <요청>` | 읽기 전용 계획 |
| `/diff`, `/resume <ID>` | Git 변경 확인과 세션 재개 |
| `/doctor`, `/quit` | 준비 상태 확인과 종료 |

메뉴에서는 위/아래, Enter, Escape를 사용합니다.
`/model main <catalog-id> high`, `/workers 3`처럼 인수를 직접 지정할 수도 있습니다.

| 키 | 동작 |
| --- | --- |
| Enter | 입력 전송 |
| 백슬래시 + Enter / Ctrl+J | 줄바꿈 |
| Shift/Alt + Enter | 터미널이 해당 키를 전달하면 줄바꿈 |
| 위 / 아래 | 이전 입력 불러오기 또는 열린 메뉴 이동 |
| Escape | 작업 중단. 두 번 누르면 입력 지우기 |
| Ctrl+C | 작업 중단. 대기 중에는 입력을 지우고 종료 준비, 한 번 더 누르면 종료 |
| Ctrl+Q | 세션 정리 후 종료 |

## 공개 웹 리서치

`node bin/hera.mjs research setup`을 한 번 실행해 Chromium을 설치하거나 `/research`를
사용하세요. 검색은 DuckDuckGo, 페이지 읽기는 요청한 공개 사이트를 이용합니다.
검색 API 키나 유료 검색 대체 경로는 없습니다. 모델 사용량은 제공자 할당량을 소비합니다.
요청은 제한된 대기열과 10분 캐시를 공유합니다.

CAPTCHA가 나타나면 `/research open`으로 직접 해결하고 `/research resume` 후
원래 요청을 다시 보내세요. 개인 브라우저 프로필은 가져오지 않습니다.
공개 검색어에 비밀키나 비공개 프로젝트 내용을 넣지 마세요.

설계·리서치 요청에는 상호 보완적인 조사, 공개 근거 수집, 종합으로 이어지는 DRD 지침을
사용합니다. 워커 상한과 웹·위임 금지 요청을 따르며 싱글 에이전트는 워커 없이 수행합니다.
이는 모델 지침으로, 리서치 품질을 보장하는 규칙 엔진은 아닙니다.
[동작과 제한](docs/web-research.md).

## 업데이트와 문제 해결

Hera를 닫고 로컬 변경을 보존한 다음 소스 체크아웃을 업데이트합니다.

```text
git pull --ff-only
npm ci
npm run build
```

Windows에서는 `npm.cmd`를 사용하세요. **`hera update` 명령은 아직 없습니다.**
`codex update`는 별도의 전역 CLI를 바꾸며 Hera의 고정 런타임을 업데이트하지 않습니다.
혼합 런타임과 검증 기록도 새 버전에 맞아야 합니다. 검토된 `.tgz` 설치와 롤백은
[Windows](docs/install-windows.md) / [macOS](docs/install-macos.md)를 참고하세요.
CI 아티팩트는 정식 배포 릴리스가 아닙니다.

| 상황 | 해결 방법 |
| --- | --- |
| 로그인·키 누락 | `/providers` 또는 `auth login openai` / `auth login go` |
| 워커 사용 차단 | `doctor` 확인. 적절한 경우 HERA 설계 `--single-agent` 사용 |
| Windows 샌드박스 미설정 | `sandbox setup` 실행 후 `doctor --json` 확인 |
| 기존 `hera` 명령과 충돌 | 로컬 실행 경로 또는 별도 설치 prefix 사용 |
| 중단되었거나 결과가 불확실한 쓰기 | Git 변경과 네이티브 이력 확인. 무조건 재실행하거나 잠금 삭제 금지 |

설정과 네이티브 세션은 분리된 Hera 홈(기본 `~/.hera`)을 사용합니다.
`HERA_HOME`은 프로젝트 밖에 두세요. OpenAI는 분리된 네이티브 로그인을,
Go는 Windows 자격 증명 관리자 또는 macOS 키체인을 사용합니다.
`HERA_OPENCODE_GO_API_KEY`는 해당 프로세스에서 저장된 Go 키보다 우선합니다.
`auth status go`는 키 존재 여부·출처만 보여주고, `auth logout go`는 저장된 항목만
삭제하며 환경 변수는 제거하지 않습니다. [보안 안내](SECURITY.md).

## 검증과 개발

[공개 CI 기록](docs/public-transition-2026-10-08.md)에는 Windows x64·macOS arm64 각각
86개 오프라인 테스트와 동일 패키지의 양쪽 설치 검증이 기록되어 있습니다.
명시된 커밋의 결과이며 이후 미커밋 변경까지 검증한 것은 아닙니다.
Windows 실사용 검증은 별도로 기록합니다. **macOS 실제 터미널·실제 모델 검증은 아직 미수행입니다.**

개발 검사: `npm run typecheck`, `npm test`, `npm run build`.
실제 모델 검사는 명시적으로 선택해야 하며 제공자 사용량을 소비할 수 있습니다.
[작업 기록](docs/status.md)과 [구현 명세](docs/implementation-spec.md)를 참고하세요.

## Hera 제품군

이 프로젝트는 터미널 코딩 에이전트입니다. 관련 프로젝트는 실제 에디터 제어 도구를 제공합니다.

- [hera-agent-unity](https://github.com/NotNull92/hera-agent-unity) — Unity 에디터 제어.
- [hera-agent-godot](https://github.com/NotNull92/hera-agent-godot) — Godot 에디터 제어.
- [hebe-agent-unity](https://github.com/NotNull92/hebe-agent-unity) — 가벼운 Unity 실행 도구.

배너의 Hera는 새롭게 디자인한 성인 여성 오피스룩 캐릭터입니다. 제품군의 금빛 별 모티프를
이어받으면서 독립적인 외형을 갖췄습니다. [아트워크 기록](docs/branding.md).

## 라이선스

Hera 자체 코드와 문서는 [Apache-2.0](LICENSE)으로 배포합니다.
[저작권 고지](NOTICE)와 [서드파티 고지](THIRD_PARTY_NOTICES.md)를 참고하세요.
[캐릭터 이미지](assets/branding/LICENSE)는 이 라이선스의 적용 대상에서 제외합니다.
선택 설치하는 Attention Span 화법 원문은 AGPL-3.0을 유지하며, Hera에 동봉하거나
Hera 라이선스로 변경하지 않습니다.
