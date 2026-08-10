# AI 활용 기록 — Meal Hero

해커톤 "AI 활용 기술 문서" 원자료. 에셋·코드 생성에 사용한 AI 도구와 프롬프트, 비용을 작업 순서대로 기록한다.

## 비용 러닝 토탈

| 도구 | 사용량 | 잔여/한도 |
|---|---|---|
| Meshy.ai | **918 크레딧** (모델 27종 + 행인 10×2세대 + 리깅·애니메이션 + 난간 재시도 30 + 신호등 헤드 30) | 182 / 1,100 |
| OpenRouter gpt-image-2 | **$0.52** (86장 × low $0.006) | $20 한도 (gpt-audio와 공유) |
| OpenRouter gpt-audio-mini | **$0.002** (보이스 4클립, 오디오 출력 601토큰 × $2.4/M) | 〃 |

## 개발 도구

- **Claude Code (Fable 5)**: 게임 코드 전체(Three.js), 맵 생성 로직, 에셋 파이프라인 스크립트 작성·실행 자율 에이전트
- **Meshy.ai text-to-3d API**: 캐릭터·탈것·방해요소 3D 모델 (meshy-5, preview 5cr + refine 10cr)
- **gpt-image-2 (OpenRouter)**: 건물 파사드·지면·계절 텍스처 (예정)

## Meshy.ai 생성 모델 (2026-08-09)

파이프라인: `scripts/meshy-batch.mjs` — preview(폴리곤 제한) → refine(2K 텍스처) → GLB 다운로드 → gltf-transform으로 텍스처 256px 축소 (PS1 룩 + 용량 27MB→1.85MB).

공통 스타일 프롬프트: `chunky cute proportions, low poly, PS1 retro game style, muted desaturated colors`

| 파일 | 용도 | 프롬프트 요약 | 폴리곤 | 크레딧 |
|---|---|---|---|---|
| character-hero.glb | 주인공 배달원 (AC-16) | cartoon Korean delivery rider, baseball cap, windbreaker | 3000 | 15 |
| prop-delivery-bag.glb | 구보 스테이지 배달가방 | square insulated food delivery backpack | 600 | 15 |
| vehicle-kickboard.glb | 여름 탈것 | stand-up electric kick scooter, teal | 1500 | 15 |
| vehicle-bicycle.glb | 가을 탈것 | city bicycle with front basket, olive | 2000 | 15 |
| vehicle-scooter.glb | 겨울 탈것 | delivery moped with rear delivery box | 2000 | 15 |
| obstacle-flyer-worker.glb | 방해요소: 전단지 알바생 | flyer distributor, visor cap, sash, arm extended | 3000 | 15 |
| obstacle-kid-bike.glb | 방해요소: 자전거 초딩 | child riding small bicycle leaning forward | 3000 | 15 |
| obstacle-pigeon.glb | 방해요소: 비둘기 | plump pigeon, round fat body | 800 | 15 |
| obstacle-drunk.glb | 방해요소: 취객 | drunk office worker, rumpled suit, swaying | 3000 | 15 |
| prop-parked-sedan.glb | 소품: 주차 세단 (박스+텍스처 방식 품질 미달로 3D 교체) | 1990s Korean compact sedan, silver-gray | 1500 | 15 |
| prop-parked-truck.glb | 소품: 주차 포터 트럭 (동일 사유) | Korean 1-ton flatbed truck, open bed, blue | 1500 | 15 |
| prop3d-*.glb 13종 | 소품 3D 교체 2차: 자판기·소화전·벤치·평상·쓰레기더미·화분·우편함·가로등·전봇대·배달상자·파라솔·빨래건조대·고양이 | 프롬프트는 `scripts/meshy-batch.mjs` MODELS 참조 | 800~1200 | 195 |

합계: **360 크레딧**, 실패·재시도 0회.

추가 텍스처: `flyer-paper.png` — 전단지 발사체용 (알바생 투척 연출, $0.006).

## Meshy.ai 리깅·애니메이션 (2026-08-09, 2차)

파이프라인: `scripts/meshy-rig-batch2.mjs` — text-to-3d(a-pose) → rigging(5cr) → Animation
Library 액션 적용(3cr) → 애니메이션 GLB 다운로드 → 256px 축소. 버텍스 변형 걷기(다리 늘어남
문제)를 스켈레톤 애니메이션으로 교체하기 위함.

| 파일 | 용도 | 액션 (action_id) | 크레딧 |
|---|---|---|---|
| character-hero-run/-idle.glb | 주인공 달리기·대기 크로스페이드 | Run_02(14) / Idle(0) | 리깅5+애니6 |
| obstacle-drunk-walk.glb | 취객 비틀걸음 | Stumble_Walk(562) | 리깅5+애니3 |
| ped-ajumma/-grandpa/-schoolgirl/-schoolboy/-officeman/-officewoman-walk.glb | 행인 배회 6종 (신규 생성+리깅) | Casual_Walk(30) / Walking_Woman(1) | 생성90+리깅30+애니18 |

| ped-jogger/-shopkeeper/-rider/-hoodie-walk.glb | 행인 배회 4종 추가 (재시도 성공, 총 10종) | Casual_Walk(30) / Walking_Woman(1) | 생성60+리깅20+애니12 |

2차 소계: **249 크레딧** (잔액 491 API 실측). 시행착오: (1) action_id를 문서 확인 없이
추정해 전량 400 오류(과금 0) — 애니메이션 라이브러리 문서의 정수 ID로 교정.
(2) 행인 4종이 Meshy 서버 측 "could not be finalized"로 preview 실패(과금 0) — 재시도로
전원 성공. 통합 검증: 행인 10종 전부 인게임 스크린샷으로 확인.

## Meshy.ai 행인 가분수 재생성 (2026-08-09, 3차)

1·2차 행인이 정상 비율로 나와 주인공(가분수)과 톤앤매너 불일치 — 프롬프트를
"oversized big head taking one third of total height, short stubby legs" 계열로 강화해
10종 전부 재생성 (`scripts/meshy-ped-chibi.mjs`, 상태 `rig-report-chibi.json`).
3차 소계: **235 크레딧** (재생성 230 + hoodie 리깅 결과물 손상 재리깅 5). 잔액 256 실측.

**3차 결과 폐기·런타임 보정으로 전환**: 3차는 극단 가분수·정상 비율 혼재에 텍스처 파손
2종(몸통에 얼굴 매핑)까지 나와 사용 불가 판정. 추가 재생성 대신 텍스처가 온전한 2차 GLB를
복원하고, 주인공 머리 비중 실측값(전체 높이의 0.316)에 맞춰 Head 본을 런타임 스케일하는
`applyHeadRatio`로 비율을 정합했다 (걷기 클립의 Head.scale 트랙 제거 필요 — mixer가 매
프레임 원복시키는 문제). 추가 크레딧 0으로 해결, 교훈: 비율은 프롬프트 재생성 도박보다
본 스케일 후처리가 확실하고 저렴하다.

## Meshy.ai 알바생 리깅·애니메이션 (2026-08-09, 4차)

전단지 알바생이 정적 모델로 슬라이드 이동(피드백) — 1차 배치의 refine 태스크
(`019fe3ae-8acb…`)를 재사용해 리깅 후 걷기·대기 애니메이션 생성 (`scripts/meshy-rig-flyer.mjs`).

| 항목 | 크레딧 | 결과물 |
|---|---|---|
| 리깅 (height 1.65m) | 5 | rig 태스크 (rig-report.json) |
| Casual_Walk (action 30) | 3 | `obstacle-flyer-worker-walk.glb` |
| Idle (action 0) | 3 | `obstacle-flyer-worker-idle.glb` |

4차 소계: **11 크레딧**. 잔액 **245 실측**. 런타임은 걷기/대기 크로스페이드 +
이동 속도에 보행 사이클 동기화, `applyHeadRatio(0.316)`로 가분수 정합 (행인과 동일 방식).

추가: 주인공이 스쿠터·자전거 안장 위에 서 있던 문제(피드백) — 기존 주인공 rig에
Chair_Sit_Idle_M(action 33) 애니메이션 **3 크레딧** 추가 (`scripts/meshy-anim-hero-sit.mjs`,
`character-hero-sit.glb`). 라이딩 전용 액션이 라이브러리에 없어 의자 앉기를 쓰되,
슬라우치 자세는 런타임 스파인 본 보정으로 상체를 펴서 탑승 자세로 변환. 잔액 **242 실측**.

## Meshy 5차 — 계단 난간 3D 교체 (2026-08-09, 피드백)

계단 난간·자전거 거치대가 `prop-railing.png` 텍스처 입힌 얇은 박스라 기둥이 평면으로
보인다는 피드백 — `prop3d-railing.glb`로 교체 (`scripts/meshy-railing*.mjs`).

| 항목 | 크레딧 | 비고 |
|---|---|---|
| 1차 preview+refine | 15 | 실패 — "posts and pipe bars" 프롬프트가 파이프 구조물로 생성됨 |
| 2차 preview | 5 | "all aligned in one single flat vertical plane" 제약 추가 — 정상 펜스 패널 |
| 2차 refine (2k) | 10 | 채택. 배치는 `props.js`에서 계단 양측 타일링 + 거치대 0.7배 재활용 |

5차 소계: **30 크레딧**. 잔액 **212 실측**. 교훈: 얇은 격자류(펜스·난간)는 text-to-3d가
취약 — "single flat vertical plane" 같은 평면 제약을 명시하고, refine 전에 preview
썸네일을 검수해 불량이면 refine 10cr을 아낄 것. `texture_resolution`은 1k 불가(2k/4k/8k만).

## gpt-image-2 생성 텍스처 (2026-08-09)

파이프라인: `scripts/gen-textures.mjs` (전체 프롬프트는 파일 내 MANIFEST 참조) → 1024px low 생성
→ `scripts/process-textures.mjs`로 256px 다운스케일 + 빌보드류(나무·고양이·빨래) 배경 알파 키잉.
총 **69장, 전량 low 품질, 실패 0** ≈ $0.41. 원본 1024px는 커밋 제외(용량), 처리본만 `assets/generated/`.

| 분류 | 수량 | 용도 |
|---|---|---|
| 계절 지면 `ground-*` | 4 | 지형 타일 (봄 흙+꽃잎 / 여름 풀 / 가을 낙엽 / 겨울 눈) |
| 계절 도로 `road-*` | 4 | 골목 리본 메시 (겨울은 젖은 트랙 포함) |
| 계절 나무 `tree-*` | 4 | 십자 빌보드 (알파 키잉) |
| 계절 하늘 `sky-*` | 4 | §7.3 배경=안개 단색 원칙에 따라 실장면 미사용(예비 에셋) |
| 빌라 파사드 `villa-01~12` + 측면 2 | 14 | 로우폴리 박스 + 파사드 텍스처 조합 (AC-17 구분성: 층수·색·창 배열 상이) |
| 상가 전면 `shop-*` | 10 | 치킨·중국집·분식·편의점·피자·족발·카페·도시락·떡볶이·버거 (한글 간판) |
| 소품 `prop-*` | 26 | §7.10 장식 30종의 텍스처 (전봇대·쓰레기봉투·차량·자판기·현수막·고양이 등) |
| 공용 재질 `shared-*` | 3 | 벽돌담·콘크리트·금속 |
| 충돌 FX `fx-*` | 2 | 비둘기 화면 충돌 연출 (`scripts/gen-fx.mjs`): 앞유리 스플랫 + 잔류 깃털 스프라이트. 마젠타 배경 생성 후 코너 평균 키잉으로 알파 추출 (2장 × low ≈ $0.012) |
| 표지판 `prop-sign-schoolzone` | 1 | 어린이보호구역 표지판 면 (상가 어닝 제거로 §7.10 30종 유지용 신규 소품, low $0.006) |
| 구멍가게 파사드 `shop-super`·`shop-baekban` | 2 | §14.2 가게 재배치(FR-28) — 빌라 사이 구멍가게 4곳용 동네슈퍼·백반집 전면 (2장 × low ≈ $0.012) |
| 인도 보도블럭 `sidewalk-*` | 4 | §15.4 인도·차도 분리(FR-36) — 계절별 보도블럭 타일 (4장 × low ≈ $0.024) |
| 타이틀 로고 `logo-title` | 1 | §15.5 (FR-37) "MEAL HERO : delivery simulator" 비트맵 로고 (`scripts/gen-logo.mjs`). 마젠타 배경 생성 후 색상 규칙(r−g>50 ∧ b−g>30) 키잉 — 프롬프트의 desaturated가 배경까지 탁하게 만들어 코너 거리 키잉(임계 60) 실패, 벽돌 레드(B≈G)와 마젠타(B≫G)를 채널 부호로 분리 (1장 × low $0.006) |

## gpt-audio-mini 보이스 SFX (2026-08-09, FR-25 §12.6)

파이프라인: `scripts/gen-voice.mjs` — OpenRouter `openai/gpt-audio-mini`, chat completions
`modalities:["text","audio"]` + `stream:true`(오디오 출력 필수 조건) + `audio.format:"pcm16"`
(스트리밍은 pcm16만 지원) → SSE `delta.audio.data` 조각 조립 → ffmpeg로 mp3 변환 + 무음 트림·5초 캡.
system 프롬프트로 캐릭터 연기 지시, user 메시지가 대사.

| 파일 | 보이스 | 연출 | 대사 |
|---|---|---|---|
| voice-flyer.mp3 | coral | 밝고 씩씩한 전단지 알바생 | "전단지 받아가세요~!" |
| voice-kid.mp3 | shimmer | 폭주 초등학생 (높고 다급하게) | "따르릉 따르릉! 비켜주세요!!" |
| voice-drunk.mp3 | ash | 만취 아저씨 웅얼거림 | "어이… 거기 학생…? 같이 한 잔…" |
| voice-pigeon.mp3 | verse | 비둘기 성대모사 (의성어만) | "구구… 구구!! 푸드드드득!!" |

총 오디오 출력 601토큰 ≈ **$0.0014** (+텍스트 입출력 미미) — 러닝 토탈 $0.44 + $0.002.
비음성 오디오(BGM 5곡·SFX 13종)는 gpt-audio로 생성 불가 → CC0 외부 에셋 사용 (`CREDITS.md`).

## gpt-audio-mini — 8차 피드백 보이스 4종 (2026-08-10, §19.1·§19.3 FR-58/59/61)

같은 파이프라인(`scripts/gen-voice.mjs`). 1차 산출물이 대사를 늘여 읽어(6~9초) 전량 폐기 후
system에 "빠르고 경쾌하게 딱 한 번, 늘여 읽기 금지" 지시를 추가해 재생성 — 그래도 긴 3클립은
ffmpeg 무음 트림 + atempo 1.25 후처리로 1.0~3.7초에 안착.

| 파일 | 보이스 | 연출 | 대사 | 용도 |
|---|---|---|---|---|
| voice-safe.mp3 | ballad | 정 많은 식당 사장님 (밝게) | "안전히 배달해주세요~" | 코드 매칭 정답 슬램 |
| voice-wrong.mp3 | ballad | 사장님 다급·당황 | "기사님 잘못 가져가셨어요~!" | 코드 매칭 오답 슬램 |
| voice-enjoy.mp3 | echo | 씩씩한 배달 기사 | "맛있게 드세요" | 전달 성공 |
| voice-fast.mp3 | sage | 놀란 손님 감탄 | "와우 빨리 오셔서 감사해요!" | 스피드 보너스 전달 |

오디오 출력 (폐기 1차 478 + 확정 2차 325) = 803토큰 ≈ **$0.0019** — 러닝 토탈 gpt-audio 합계 ≈ $0.004.
니어미스 경적(sfx-horn)은 AI 아닌 ffmpeg 사인파 합성 자체 제작, 유리 파손(sfx-glass)은 Kenney CC0 (`CREDITS.md`).

## gpt-image-2 — 5차 확장: 교차로 신호 텍스처 (2026-08-10)

FR-41 횡단보도·신호등용 3장, 전부 low($0.006) 1발 성공 — 누적 $0.51 (85장).

| 파일 | 용도 | 프롬프트 요약 |
|---|---|---|
| texture-crosswalk.png | 횡단보도 노면 (256², 축별로 텍스처 90° 회전 재사용) | top-down zebra stripes on worn asphalt, PS1 low-res |
| prop-signal-ped.png | 보행 신호등 전면 아틀라스 (512², 좌=적 우=녹, UV 반분) | two panels, red standing / green walking pictogram |
| prop-signal-car.png | 차량 신호등 전면 아틀라스 (512², 동일 반분) | two panels, vertical two-lamp, red lit / green lit |

아틀라스 반분은 텍스처 clone + repeat 0.5 + offset — three.js r135+는 clone이 Source를
공유해 로드 전 clone도 안전. 등화 자발광은 Lambert `emissiveMap`(동일 텍스처)로 처리해
어두운 하우징 픽셀은 그대로 어둡게 유지된다.

## Meshy 6차 — 신호등 헤드 3D 교체 (2026-08-10, 피드백)

FR-41 신호등이 "텍스처 씌운 박스" 티가 난다는 피드백 — 헤드 2종을 Meshy로 교체
(스크립트: scratchpad gen-signal-models.mjs, preview 썸네일 검수 후 refine).

| 항목 | 크레딧 | 결과물 |
|---|---|---|
| prop3d-signal-car.glb — 한국식 가로형 3구 차량등 헤드 | preview 5 + refine 10 | 48KB (텍스처 256px 축소) |
| prop3d-signal-ped.glb — 세로 2칸 보행등 헤드 | preview 5 + refine 10 | 43KB |

6차 소계: **30 크레딧**. 잔액 **182**. 등화 상태는 베이크드 텍스처로 전환 불가 —
소켓 위 자발광 오버레이(차량등: 좌적/우녹 원반, 보행등: 위 빨강 서있는 / 아래 초록
걷는 픽토그램 — 기존 prop-signal-ped.png 아틀라스 재사용)의 가시성 토글로 구현.
prop-signal-car.png 아틀라스는 모델 교체로 미사용 전환 (파일은 기록용 유지).

## gpt-image-2 — 9차 확장: 대시 넉백 임팩트 스프라이트 (2026-08-10)

FR-65 (§20.2) "쿵" 임팩트용 1장, low($0.006) 1발 성공 — 누적 **$0.52** (86장).

| 파일 | 용도 | 프롬프트 요약 |
|---|---|---|
| fx-impact-star.png (게임은 256² 다운스케일본 사용) | 대시 넉백 충돌 스타버스트 빌보드 | comic impact starburst, golden yellow center, jagged dark outline, chunky pixel art, black background |

검정 배경으로 생성해 additive 블렌딩(THREE.Sprite)으로 합성 — 알파 추출 불필요, 발광 룩 덤.
타격 SFX(sfx-thud)는 Kenney Impact Sounds CC0 impactPunch_heavy_004에 ffmpeg 저역 부스트(`CREDITS.md`).
