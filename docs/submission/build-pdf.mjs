// 제출 문서 md → pdf 빌드: marked로 HTML 생성 후 Chrome headless 인쇄.
// 실행: node docs/submission/build-pdf.mjs  (repo 루트 기준)
import { marked } from 'marked';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const CSS = `
  * { box-sizing: border-box; }
  body {
    font-family: 'Apple SD Gothic Neo', 'Pretendard', sans-serif;
    color: #26262a; line-height: 1.62; font-size: 11.5pt;
    max-width: 100%; margin: 0; padding: 0 6px;
  }
  h1 { font-size: 21pt; border-bottom: 3px solid #b5372f; padding-bottom: 8px; margin: 0 0 18px; }
  h2 { font-size: 15pt; color: #b5372f; margin: 26px 0 10px; page-break-after: avoid; }
  h3 { font-size: 12.5pt; margin: 18px 0 8px; page-break-after: avoid; }
  p { margin: 8px 0; }
  blockquote {
    margin: 12px 0; padding: 10px 16px; background: #f4f1ea;
    border-left: 4px solid #c9a13b; font-size: 11pt;
  }
  blockquote p { margin: 4px 0; }
  table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 10.5pt; page-break-inside: avoid; }
  th, td { border: 1px solid #c9c4b8; padding: 6px 9px; text-align: left; vertical-align: top; }
  th { background: #efeeea; }
  code { font-family: 'Menlo', monospace; font-size: 9.5pt; background: #f0ede6; padding: 1px 4px; border-radius: 3px; }
  pre { background: #f4f1ea; border: 1px solid #ddd8cc; border-radius: 6px; padding: 10px 14px; overflow: hidden; white-space: pre-wrap; word-break: break-all; page-break-inside: avoid; }
  pre code { background: none; padding: 0; }
  img { max-width: 100%; display: block; margin: 14px auto 4px; border: 1px solid #ddd8cc; border-radius: 4px; page-break-inside: avoid; }
  img + em, img ~ em { display: block; text-align: center; }
  li { margin: 3px 0; }
  a { color: #2e5f8f; text-decoration: none; word-break: break-all; }
  hr { border: none; border-top: 1px solid #ddd8cc; margin: 20px 0; }
`;

for (const name of ['game-introduction', 'ai-usage-report']) {
  const md = readFileSync(resolve(DIR, `${name}.md`), 'utf8');
  const body = marked.parse(md);
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${CSS}</style></head><body>${body}</body></html>`;
  const htmlPath = resolve(DIR, `${name}.html`);
  writeFileSync(htmlPath, html);
  const pdfPath = resolve(DIR, `${name}.pdf`);
  execFileSync(CHROME, [
    '--headless', '--disable-gpu', '--no-pdf-header-footer',
    '--print-to-pdf-no-header',
    `--print-to-pdf=${pdfPath}`,
    `file://${htmlPath}`,
  ], { stdio: 'pipe' });
  console.log('built', pdfPath);
}
