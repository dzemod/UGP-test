# UGP site — demo content to replace before launch

Everything below is **demonstration content** for the design mockup. In the code each item is marked with
`DEMO — replace with real data before launch`. Search the project for that phrase to find every place.

> The client brief says: «Кейси поки не включаємо; умовні логотипи та вигадані відгуки не використовуємо».
> The demo names, demo review and AI photos must **not** go live. Replace them with real, approved
> material — or remove/hide the block before launch.

## Must replace (fictional)

| What | Where (site/index.html) | English text (site/assets/i18n/en.js) | Replace with |
|---|---|---|---|
| Partner photos (AI-generated) — `team-1.jpg`, `team-2.jpg`, `team-3.jpg` | Team section | — | Real partner portraits |
| Partner names: Олександр Коваленко, Андрій Мельник, Ірина Шевчук | Team section, keys `team.n1`–`team.n3` | `team.n1`–`team.n3` | Real names (UA + EN transliteration) |
| Review 1 text (investor — restarted stalled project) | Reviews slider, key `reviews.quote1` | `reviews.quote1` | A real review, approved by the client in writing |
| Review 1 author: Віктор Бондаренко, «Інвестор, девелоперська компанія» | keys `reviews.name1`, `reviews.pos1` | `reviews.name1`, `reviews.pos1` | Real name (or initials) and position, with permission |
| Review 2 text (private investor — due diligence before investing) | key `reviews.quote2` | `reviews.quote2` | A real review, approved in writing |
| Review 2 author: Олена Ткаченко, «Приватна інвесторка» | keys `reviews.name2`, `reviews.pos2` | `reviews.name2`, `reviews.pos2` | Real name (or initials) and position, with permission |
| Review 3 text (foreign investor — UGP as partner in Ukraine, NDA, English) | key `reviews.quote3` | `reviews.quote3` | A real review, approved in writing |
| Review 3 author: Томас Бреннер / Thomas Brenner, «Керуючий партнер, європейська інвестиційна група» | keys `reviews.name3`, `reviews.pos3` | `reviews.name3`, `reviews.pos3` | Real name (or initials) and position, with permission |
| Review 4 text (agricultural land owner — land rights and permits) | key `reviews.quote4` | `reviews.quote4` | A real review, approved in writing |
| Review 4 author: Микола Гнатюк, «Власник агропідприємства» | keys `reviews.name4`, `reviews.pos4` | `reviews.name4`, `reviews.pos4` | Real name (or initials) and position, with permission |
| Reviewer photos (AI-generated) — `review-1.jpg` … `review-4.jpg` | Reviews slider, `.reviews__media` (one `<img data-slide>` per review) | — | Real photos with permission, or remove the photo column |

Fewer real reviews than four? Delete the matching `<img data-slide>` and `<figure data-slide>` pair — the counter and
arrows adapt automatically. With only one review left the arrows are hidden and it shows as a single quote.
| Case photos (AI-generated) — `case-1.jpg`, `case-2.jpg`, `case-3.jpg` | Cases section | — | Real project photos or licensed photos |

## To approve with the client (based on the brief, not fictional)

| What | Keys | Note |
|---|---|---|
| 3 typical scenarios: «Відновлення зупиненого житлового проєкту», «Перевірка бізнес-центру перед інвестуванням», «Організація девелоперського проєкту житлового комплексу» | `case1.*`, `case2.*`, `case3.*` | Written as typical tasks from the brief's service list — no client names, numbers or dates. Approve wording. |
| English translation of the whole site | `site/assets/i18n/en.js` | Draft — needs the client's approval of the translation. |

## Still placeholders (shown as such on the page)

| What | Where | Needed from the client |
|---|---|---|
| «Нам довіряють» logo strip — currently replaced by «З ким ми працюємо»; the old strip is kept as a commented-out block with instructions | Trust section in `index.html` | Client logos, only after written permission |
| Legal entity name and ЄДРПОУ code | Footer (dashed box), key `footer.legal` | Legal details |
| Privacy policy text (DEMO page) | `site/privacy.html` — UA + EN placeholder, marked DEMO, `noindex` | The approved privacy policy text (replace both language blocks, remove the DEMO note and `noindex`) |
| Telegram and Viber links — **hidden** until links are provided | Contacts card (`<li … hidden>` with `data-todo`) and footer (`<li hidden>`) | Exact messenger links. To turn on: remove `hidden`, set the `href`s, remove `data-todo`, set `.contacts` back to `repeat(4, …)` in `style.css` |
| Form destination | `<form data-endpoint="">` in Contact form | CRM / e-mail / Telegram-bot endpoint |
| Link-preview image address | `<meta property="og:image">` | Final domain if not `https://ugp.ua` |

## How to replace a photo

Put the new photo into `images/`, then make a web copy into `site/assets/img/` with the same file name
(max ~1800 px wide; ~900 px for portraits). The site applies the colour treatment automatically.

The page loads smaller copies on phones and small screens (`<name>-600.jpg`, `<name>-1200.jpg`, via `srcset`).
After replacing a photo, regenerate them: `node tools/resize_images.cjs --force <name>` (needs `puppeteer-core`, see the comment at the top of the script).
