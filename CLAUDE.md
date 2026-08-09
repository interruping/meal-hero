# Meal Hero — 프로젝트 지침

NAN 2026 해커톤 사전 과제. 기획·요구사항·완료 기준은 전부 `PRD.md`가 단일 기준(source of truth).

## Compact 시 보존 사항

컨텍스트 compact(자동·수동 모두)가 일어나면 요약에 반드시 다음을 유지한다:

1. **현재 목표**: `PRD.md` §11 완료 기준(AC) 전체 통과가 최종 목표라는 사실. compact 직후 `PRD.md`와 이 파일(`CLAUDE.md`)을 다시 읽고 작업 재개
2. **진행 상황**: 완료한 FR/AC 번호 목록, 현재 작업 중인 FR 번호, 직전에 하던 구체적 작업
3. **미해결 문제**: 실패 중인 검증, 알려진 버그, 시도했다 실패한 접근(같은 실수 반복 방지)
4. **비용 상태**: 이미지 생성 누적 지출 추정액, Meshy 크레딧 사용량 추정
5. **작업 규칙 리마인드**: dev 브랜치에서 작업, 기능 단위 커밋, main merge는 검증 후 `--no-ff`

작업 상세 기록은 컨텍스트에만 의존하지 말고 커밋 메시지와 `AI_USAGE.md`에 남겨 compact 후에도 파일로 복원 가능하게 한다.

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

## 에셋 원칙 — 단색 박스 금지

**색만 칠한 프리미티브(Box/Cylinder/Plane) 조립으로 오브젝트를 대신하지 않는다.** 이건 미완성이며 AC 통과로 치지 않는다.

- 개발 초기에 임시 박스를 쓰는 것은 허용하되, 해당 FR을 완료 처리하기 전에 반드시 실제 에셋으로 교체한다. "로우폴리 스타일"을 텍스처 생략의 근거로 쓰지 말 것
- 필요 수량과 완료 기준은 `PRD.md` §7.10 / FR-18 / AC-16~AC-20
- 도구 선택 기준:
  - **Meshy.ai** — 캐릭터, 탈것, 방해요소처럼 형태 자체가 중요한 고유 3D 모델 (필수)
  - **gpt-image-2** — 텍스처 전반: 건물 파사드, 도로·지면, 하늘, 간판, 계절 배리에이션. 로우폴리 지오메트리에 입혀 쓴다
  - 무료 로우폴리 에셋(Kenney, Quaternius) — 흔한 소품 보강용. 단 §7.10 수량 카운트에는 AI 생성물이 우선
- 건물 20종은 Meshy로 전부 뽑지 말 것 — 크레딧 낭비. 로우폴리 박스 형태 + **gpt-image-2 파사드 텍스처 조합**이 PS1 룩에도 맞고 저렴하다. 창문·간판·벽돌이 텍스처에 그려져 있으면 단색 박스가 아니다
- 에셋 하나 완성할 때마다 `AI_USAGE.md`에 즉시 기록 (툴·프롬프트·비용·용도)

### 생성 순서 (권장)

1. 캐릭터·방해요소 9종 Meshy 생성 — 게임 인상을 좌우, 최우선
2. 건물 파사드 텍스처 배치 생성 (gpt-image-2 low) — 20종 이상
3. 지면·도로·하늘·계절 텍스처 (gpt-image-2 low)
4. 장식 오브젝트 30종 — 텍스처 아틀라스 1~2장으로 여러 소품을 커버하는 방식 허용 (비용 절감)

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

## 오디오 리소스 생성 (OpenRouter / openai/gpt-audio)

- API 키: 이미지와 동일하게 `.env`의 `OPENROUTER_API_KEY` 사용 (**$20 총 한도를 이미지와 공유** — 러닝 토탈에 합산)
- 키 값 출력 금지·`.env` 커밋 금지 규칙 동일 적용
- **음성 기반 산출물 전용**: 나레이션(오프닝·엔딩 컷씬), 캐릭터 대사, 보이스성 효과음(취객 웅얼거림 등). **음악(BGM)·정교한 비음성 SFX는 이 모델로 못 만든다** — 기존 WebAudio 프로시저럴(`src/core/audio.js`) 유지
- 모델: 기본 `openai/gpt-audio-mini` (오디오 출력 $2.4/M 토큰). 품질 부족할 때만 `openai/gpt-audio` ($64/M 토큰 — 약 27배 비쌈)
  - 오디오 출력은 약 10토큰/초. 10초 대사 기준 mini ≈ $0.0002, gpt-audio ≈ $0.0064 — 저렴하지만 `AI_USAGE.md` 러닝 토탈에 기록은 유지
- 엔드포인트: 전용 TTS 엔드포인트가 아니라 **chat completions + `modalities` 파라미터** 방식. 응답의 `choices[0].message.audio.data`에 base64 오디오가 담긴다
- 보이스 옵션: `alloy`, `ash`, `ballad`, `coral`, `echo`, `sage`, `shimmer`, `verse`. 톤·감정·속도 연출은 system 메시지로 지시
- 결과물은 `assets/audio/`에 저장 (Vite publicDir이라 런타임 경로는 `ASSET_BASE + 'audio/...'`), 파일명은 용도 기반 (`voice-opening-narration.mp3` 등). 포맷은 웹 용량 고려해 `mp3` 권장
- 생성 전 필요한 대사 목록을 정리해 배치로 계획 — 같은 대사 반복 재생성 낭비 금지. 한국어 대사 생성 가능
- 생성 내역(대사 원문·보이스·모델·비용)은 `AI_USAGE.md`에 즉시 기록

### 호출 예시

```bash
curl -s https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-audio-mini",
    "modalities": ["text", "audio"],
    "audio": { "voice": "ash", "format": "mp3" },
    "messages": [
      { "role": "system", "content": "다음 대사를 <톤·감정·속도 지시>로 한국어로 읽어라. 대사 외 다른 말 금지." },
      { "role": "user", "content": "<대사 원문>" }
    ]
  }' | python3 -c "import json,sys,base64; r=json.load(sys.stdin); open('assets/audio/<용도>.mp3','wb').write(base64.b64decode(r['choices'][0]['message']['audio']['data']))"
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

### 예산 배분 계획 (PRD §7.10 수량 기준)

- gpt-image-2 low ≈ $0.006/장. 건물 파사드 20~25장 + 지면·하늘·계절 텍스처 20장 + 소품 아틀라스 10장 ≈ 55장 ≈ **$0.33**. 재시도 여유를 3배 잡아도 $1 내외 — 이미지 예산은 넉넉하다. 결과가 부족하면 핵심 텍스처만 medium으로 재생성
- Meshy 크레딧 1,100은 캐릭터·탈것·방해요소 9종에 집중한다. 모델당 재시도 1~2회를 감안해 배분하고, 건물·소품을 Meshy로 대량 생성하지 않는다
- 실제 크레딧 단가는 https://docs.meshy.ai/llms.txt 확인 후 첫 생성 시점에 산정해 `AI_USAGE.md`에 기록. 잔여량이 계획보다 빠르게 줄면 즉시 계획을 축소하고 사용자에게 보고
