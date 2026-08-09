# AI 활용 기록 — Meal Hero

해커톤 "AI 활용 기술 문서" 원자료. 에셋·코드 생성에 사용한 AI 도구와 프롬프트, 비용을 작업 순서대로 기록한다.

## 비용 러닝 토탈

| 도구 | 사용량 | 잔여/한도 |
|---|---|---|
| Meshy.ai | **360 크레딧** (24모델 × 15cr) | 740 / 1,100 |
| OpenRouter gpt-image-2 | **$0.43** (72장 × low $0.006) | $20 한도 |

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
