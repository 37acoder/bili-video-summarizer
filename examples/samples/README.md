# Sample inputs and outputs

Two real Bilibili videos, each shown as the transcript that goes in
(`*.input.txt`) and the chaptered-outline summary that comes out
(`*.output.md`), so you can get a feel for the result.

| Video | Input | Output |
| --- | --- | --- |
| [BV1KLhi6oEh5](https://www.bilibili.com/video/BV1KLhi6oEh5/) — 教程类 · 11 min | `BV1KLhi6oEh5.input.txt` | `BV1KLhi6oEh5.output.md` |
| [BV1Wmao6JEQy](https://www.bilibili.com/video/BV1Wmao6JEQy/) — 评论类 · 8 min | `BV1Wmao6JEQy.input.txt` | `BV1Wmao6JEQy.output.md` |

- The `input.txt` files are the grouped captions (the transcript the module feeds
  to the model).
- The `output.md` files are the model's summary. They were produced with
  `examples/bilibili.ts` (options: `outputLanguage: 'zh-CN'`, `detailLevel: 600`,
  `showTimestamp: true`) using the default `deepseek-flash` model.
- Summaries are model output and vary from run to run; treat these as examples,
  not fixtures.
