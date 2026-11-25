# node-red-contrib-afya-lullaby

[![npm](https://img.shields.io/npm/v/node-red-contrib-afya-lullaby)](https://www.npmjs.com/package/node-red-contrib-afya-lullaby)
[![license: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Node-RED dimmer helper: changes a value **from X to Y in Z seconds**. Made for my children, who like falling asleep with the light on – it dims the light slowly. It also works the other way round, as a slow wake-up light.

**[English](#english) · [Polski](#polski)**

---

## English

The node does not control a lamp itself – it calculates the value. Use `msg.payload.value` for your light.

### Install

```bash
cd ~/.node-red
npm install node-red-contrib-afya-lullaby
```

Requires Node-RED ≥ 3.0 and Node.js ≥ 18. The node appears in the **AFYA** palette group as **lullaby**.

### Configuration

| Field | Description |
|---|---|
| **Start value** | Value at the beginning (e.g. 100). |
| **Stop value** | Value at the end (e.g. 0). Start > stop: dimming; start < stop: brightening. |
| **Step** | Change per step (integer > 0). |
| **Time** | Total time in seconds (20 min = 1200). |
| **Variable** | Context variable with the current state – `global` (readable from any flow) or `flow`. |
| **Name** | Optional label. |

### Input

* any message – start (ignored while running),
* `msg.payload = "stop"` or `"kill"` – stop at the current value.

### Output

```json
{ "value": 57, "state": "counting", "direction": "down", "timestamp": 1764057600000 }
```

`state`: `counting` while running, `end` with the final (stop) value.

The context variable additionally holds `startValue`, `stopValue`, `startTime`, `stopTime` and can have
`state` = `killed` or `stopped` (redeploy).

Example flow: <https://flows.nodered.org/flow/ce2fe16f73fc82e2760eaaadf28991b9>

### Upgrading to 0.1.0

The node was registered under a wrong key in `package.json` (`afya-panic-button`) – fixed, both packages can now
be installed side by side. Older nodes get the context variable when you open and save them.
See [change.log](change.log).

---

## Polski

Zmienia wartość **od X do Y w czasie Z sekund**. Stworzony dla moich dzieci, które lubią zasypiać przy zapalonym
świetle – powoli je wygasza. Działa też w drugą stronę, jako budzenie światłem.

Węzeł nie steruje lampą – tylko liczy wartość. Użyj `msg.payload.value`.

### Instalacja

```bash
cd ~/.node-red
npm install node-red-contrib-afya-lullaby
```

Wymaga Node-RED ≥ 3.0 i Node.js ≥ 18. Węzeł **lullaby** jest w grupie palety **AFYA**.

### Użycie

* **Start value / Stop value** – od czego do czego (start > stop: gaszenie, start < stop: rozjaśnianie),
* **Step** – zmiana na krok, **Time** – czas w sekundach (20 min = 1200),
* **Variable** – zmienna **global** lub **flow** z bieżącym stanem (dostępna z innych flow),
* dowolna wiadomość uruchamia, `msg.payload = "stop"` lub `"kill"` przerywa.

Na wyjściu: `{ value, state, direction, timestamp }`, `state`: `counting` lub `end`.

---

Marcin Chuć · [MIT](LICENSE)
