# Meal Hero — 프로젝트 지침

NAN 2026 해커톤 사전 과제. 기획·요구사항·완료 기준은 전부 `PRD.md`가 단일 기준(source of truth).

## Git 전략

커밋 기록 자체가 해커톤 심사 대상. "과정이 보이는 기록"이 목표.

### 브랜치

- **main**: 항상 플레이 가능한 안정 상태만 존재. GitHub Pages 배포 소스. 직접 커밋 금지
- **dev**: 모든 작업은 여기서. 기본 작업 브랜치
- release 브랜치 없음 — GitHub Pages(main)가 곧 release
- main으로 merge 조건: 기능(FR) 단위 완료 + 브라우저에서 직접 검증 통과. merge는 `--no-ff`로 해서 기능 단위 묶음이 기록에 남게 한다
- force push, 히스토리 재작성(rebase -i, amend된 푸시) 금지 — 심사 대상 기록 훼손

### 커밋 단위

- **하나의 논리적 변경 = 하나의 커밋.** 기능 하나, 버그 수정 하나, 에셋 배치 하나
- 작게 자주. 세션 종료나 하루 끝에 몰아서 커밋 금지 — 진행 과정이 안 보임
- 빌드 깨진 상태로 커밋 금지 (dev에서도). 커밋 전 게임이 로드되는지 확인
- 튜닝 수치 변경(속도·밸런스)도 독립 커밋 — 밸런싱 과정이 기록으로 남는 게 심사에 유리

### 커밋 메시지

형식: `type: 요약 (FR-N)` — 관련 FR/AC 번호 있으면 참조

| type | 용도 |
|---|---|
| feat | 게임 기능 추가 |
| fix | 버그 수정 |
| art | 그래픽·에셋·룩앤필 작업 |
| tune | 밸런스·수치 조정 |
| docs | PRD, AI_USAGE, CREDITS, README |
| chore | 빌드 설정, 배포, 의존성 |

예시:
- `feat: 배달 픽업/전달 루프 구현 (FR-3)`
- `art: 봄 스테이지 벚꽃 텍스처 적용`
- `tune: 겨울 스쿠터 관성 계수 하향`

요약은 한국어 허용, 50자 이내. 본문 필요 시 "왜"를 적는다 (무엇은 diff가 보여줌).

## 이미지 리소스 생성 (OpenRouter / gpt-image-2)

- API 키: `.env`의 `OPENROUTER_API_KEY` (총 한도 **$20** — 초과 불가, 아껴 쓸 것)
- `.env`는 절대 커밋하지 않는다 (`.gitignore` 유지). 키 값을 로그·코드·문서에 출력 금지
- 모델: `openai/gpt-image-2` (OpenRouter 경유)
- **품질은 `low` 또는 `medium`만 사용. `high` 금지**
  - 기본값 `low` (1024×1024 약 $0.006). 결과물이 용도에 부족할 때만 `medium` (약 $0.053)
  - 게임 텍스처는 어차피 저해상도로 다운스케일 + nearest 필터 적용하므로 low로 충분한 경우가 대부분
- 생성 전 프롬프트를 정리해 **배치로 계획 후 생성** — 같은 이미지를 반복 재생성하며 낭비하지 말 것
- 생성한 이미지는 `assets/generated/`에 저장, 파일명은 용도 기반 (`texture-road-spring.png` 등)
- 생성 내역(프롬프트·품질·용도)은 `AI_USAGE.md`에 즉시 기록 — 해커톤 "AI 활용 기술 문서" 재료
- 아트 스타일은 PRD §7 아트 디렉션 준수: PS1 레트로 로우파이, 저해상도 픽셀 텍스처, 저채도 팔레트

### 호출 예시

```bash
curl -s https://openrouter.ai/api/v1/images/generations \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-image-2",
    "prompt": "<prompt>",
    "size": "1024x1024",
    "quality": "low"
  }'
```

## 3D 리소스 생성 (Meshy.ai)

- API 키: `.env`의 `MESHY_AI_API_KEY` (잔액 **1,100 크레딧** — 초과 불가, 아껴 쓸 것)
- API 사용법·엔드포인트·크레딧 비용은 **https://docs.meshy.ai/llms.txt 를 반드시 먼저 읽고** 그 문서 기준으로 호출
- 키 값을 로그·코드·문서에 출력 금지 (`.env` 커밋 금지 동일 적용)
- 생성 전 필요한 모델 목록을 정리해 배치로 계획 — 같은 모델 반복 재생성 낭비 금지
- 결과물은 GLB/GLTF로 받아 `assets/models/`에 저장, 파일명은 용도 기반 (`vehicle-scooter.png` 아닌 `vehicle-scooter.glb` 등)
- 아트 스타일은 PRD §7 준수: 로우폴리 우선. 폴리곤 수 낮은 옵션이 있으면 그것 사용 (레트로 룩 + 웹 성능 둘 다 이득)
- 생성 내역(프롬프트·크레딧 소모·용도)과 크레딧 러닝 토탈을 `AI_USAGE.md`에 즉시 기록
- 크레딧은 최대한 아껴 써서 바닥나는 일이 없도록 한다 — 생성 전 꼭 필요한지 재검토, 저비용 옵션 우선 선택
- 잔여 크레딧이 소진되어 생성 불가 시 즉시 중단하고 사용자에게 보고
- 무료 로우폴리 에셋(Kenney, Quaternius)으로 충분한 것은 크레딧 쓰지 말 것 — Meshy는 기성 에셋에 없는 고유 모델(탈것·방해요소 캐릭터 등)에만 사용

## 비용 가드레일

- 이미지 생성 누적 지출을 대략 추적: low ≈ $0.006/장, medium ≈ $0.053/장 기준으로 `AI_USAGE.md`에 러닝 토탈 기록
- 누적 추정 $15 도달 시 생성 중단하고 사용자에게 보고
- 대량 생성(10장 이상 배치)은 실행 전 목록을 사용자에게 확인받을 것
