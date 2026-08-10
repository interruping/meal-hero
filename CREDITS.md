# CREDITS

## AI 생성 에셋

- 3D 모델 9종 (`assets/models/*.glb`): Meshy.ai text-to-3d로 생성. 프롬프트·비용은 `AI_USAGE.md` 참조
- 텍스처 (`assets/generated/*.png`): OpenAI gpt-image-2 (OpenRouter 경유) 생성. `AI_USAGE.md` 참조
- 방해요소 보이스 4종 (`assets/audio/voice-*.mp3`): OpenAI gpt-audio-mini (OpenRouter 경유) 생성. `scripts/gen-voice.mjs`, `AI_USAGE.md` 참조

## 오디오 (외부 무료 에셋, FR-25)

- BGM 5곡 (`assets/audio/bgm-*.mp3`): Juhani Junkala 칩튠 — **CC0 (Public Domain)**
  - [5 Chiptunes (Action)](https://opengameart.org/content/5-chiptunes-action) → 메뉴(Title Screen)·여름(Level 1)·겨울(Level 3)
  - [4 Chiptunes (Adventure)](https://opengameart.org/content/4-chiptunes-adventure) → 봄(Stage 1)·가을(Stage 2)
  - 원본 wav/ogg를 ffmpeg로 mp3(VBR q5) 변환
- 효과음 (`assets/audio/sfx-*.mp3`): [Kenney](https://kenney.nl/) 오디오 팩 — **CC0**
  - Interface Sounds(수락·부저·오답·게임오버), Casino Audio(돈소리·영수증·픽업·점프·스킬), Impact Sounds(피격·과속 충돌·유리 파손), 일부는 ffmpeg amix로 2음원 합성 (정산·게임오버)
  - 예외: 니어미스 경적(`sfx-horn.mp3`)은 ffmpeg 사인파 합성으로 자체 제작 (외부 에셋 아님)

## 라이브러리

- [Three.js](https://threejs.org/) — MIT License
- [Vite](https://vite.dev/) — MIT License

## 폰트

- [Galmuri11](https://github.com/quiple/galmuri) (갈무리11, 한글 픽셀 폰트) — SIL Open Font License 1.1
