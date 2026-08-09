// FR-25 §12.6 보이스형 SFX 생성 — OpenRouter openai/gpt-audio-mini
// 사용법: node scripts/gen-voice.mjs  (.env의 OPENROUTER_API_KEY 사용)
// 방해요소 4종의 캐릭터 보이스. 결과물은 assets/audio/voice-*.mp3
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const KEY = env.match(/OPENROUTER_API_KEY=(\S+)/)?.[1];
if (!KEY) throw new Error('OPENROUTER_API_KEY not found in .env');

const CLIPS = [
  {
    file: 'voice-flyer.mp3',
    voice: 'coral',
    system: '당신은 한국 길거리에서 전단지를 나눠주는 밝고 씩씩한 알바생입니다. 지시된 대사만 힘차고 상냥하게 외치세요. 다른 말 금지.',
    text: '전단지 받아가세요~!',
  },
  {
    file: 'voice-kid.mp3',
    voice: 'shimmer',
    system: '당신은 자전거를 타고 폭주하는 한국 초등학생입니다. 높고 앳된 목소리로 지시된 대사만 다급하게 외치세요. 다른 말 금지.',
    text: '따르릉 따르릉! 비켜주세요!!',
  },
  {
    file: 'voice-drunk.mp3',
    voice: 'ash',
    system: '당신은 밤거리의 만취한 한국 아저씨입니다. 혀가 꼬인 낮은 목소리로 지시된 대사만 웅얼거리세요. 다른 말 금지.',
    text: '어이… 거기 학생…? 같이 한 잔… 어어…',
  },
  {
    file: 'voice-pigeon.mp3',
    voice: 'verse',
    system: '당신은 성대모사 개그맨입니다. 놀라서 날아오르는 비둘기 울음과 날갯짓 소리를 입으로 실감나게 흉내내세요. 사람 말 금지, 의성어만.',
    text: '구구… 구구!! 푸드드드득!!',
  },
];

for (const clip of CLIPS) {
  const out = new URL(`../assets/audio/${clip.file}`, import.meta.url);
  if (existsSync(out)) {
    console.log(`skip (exists): ${clip.file}`);
    continue;
  }
  // OpenRouter 오디오 출력은 stream:true 필수 — SSE delta.audio.data 조각을 이어붙인다
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai/gpt-audio-mini',
      stream: true,
      modalities: ['text', 'audio'],
      // 스트리밍은 pcm16(24kHz mono)만 지원 — 수신 후 ffmpeg로 mp3 변환
      audio: { voice: clip.voice, format: 'pcm16' },
      messages: [
        { role: 'system', content: clip.system },
        { role: 'user', content: clip.text },
      ],
    }),
  });
  if (!res.ok) {
    console.error(`FAIL ${clip.file}: HTTP ${res.status}`, (await res.text()).slice(0, 200));
    continue;
  }
  const parts = [];
  let usage = null;
  let buf = '';
  for await (const chunk of res.body) {
    buf += Buffer.from(chunk).toString('utf8');
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
      try {
        const j = JSON.parse(line.slice(6));
        const a = j.choices?.[0]?.delta?.audio?.data;
        if (a) parts.push(Buffer.from(a, 'base64'));
        if (j.usage) usage = j.usage;
      } catch { /* partial line */ }
    }
  }
  if (!parts.length) {
    console.error(`FAIL ${clip.file}: no audio deltas`);
    continue;
  }
  const pcmPath = new URL(`../assets/audio/${clip.file}.pcm`, import.meta.url);
  writeFileSync(pcmPath, Buffer.concat(parts));
  execSync(`ffmpeg -loglevel error -y -f s16le -ar 24000 -ac 1 -i "${pcmPath.pathname}" -codec:a libmp3lame -q:a 4 "${out.pathname}"`);
  rmSync(pcmPath);
  console.log(`saved: ${clip.file} (audio tokens: ${usage?.completion_tokens_details?.audio_tokens ?? '?'})`);
}
