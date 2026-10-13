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
| Review text (investor, restarted project) | Reviews section, key `reviews.quote` | `reviews.quote` | A real review, approved by the client in writing |
| Reviewer name: Віктор Бондаренко | key `reviews.name` | `reviews.name` | Real name, or initials if the client prefers |
| Reviewer position: «Інвестор, девелоперська компанія» | key `reviews.pos` | `reviews.pos` | Real position/company (with permission) |
| Reviewer photo (AI-generated) — `review-1.jpg` | Reviews section | — | Real photo with permission, or remove the photo column |
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
| Privacy policy link | Form consent + footer (`data-todo="privacy-policy"`) | Privacy policy page/URL |
| Telegram and Viber links | Contacts section (`data-todo="telegram"`, `data-todo="viber"`) | Exact messenger links |
| Form destination | `<form data-endpoint="">` in Contact form | CRM / e-mail / Telegram-bot endpoint |
| Link-preview image address | `<meta property="og:image">` | Final domain if not `https://ugp.ua` |

## How to replace a photo

Put the new photo into `images/`, then make a web copy into `site/assets/img/` with the same file name
(max ~1600 px on the long side for case photos, ~900 px for portraits). The site applies the colour treatment automatically.
