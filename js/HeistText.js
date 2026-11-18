// HeistText.js — the game's interface strings (Russian) and the formatting helpers.

/** @satisfies {Record<string, any>} */
const HeistText = {
    ru: {
        'title': 'Уровень {n}. {name}',
        'mode.plan': 'ПЛАН',
        'mode.run': 'ИСПОЛНЕНИЕ',
        'clock.plan': 'План {who}: {end}  ·  вид на {t}',
        'clock.run': 'Время {t}',
        'status.none': 'Тихо',
        'status.alarm': 'ТРЕВОГА: полиция в {t}',
        'status.patrol': 'Патруль на улице!',
        'status.freeze': 'FREEZE: все замерли',
        'status.patrolAt': 'Патруль около {t}',
        'hint.plan': 'тап по клетке — дойти  ·  кнопки справа — действие в клетке  ·  колесо — зум, ПКМ/палец — камера',
        'hint.run': 'идёт повтор плана  ·  «К плану» — править',
        'btn.wait': 'Ждать +{s}',
        'btn.undo': 'Отменить',
        'btn.clear': 'Очистить',
        'btn.play': 'Пуск ▶',
        'btn.pause': 'Пауза',
        'btn.plan': 'К плану',
        'btn.speed': 'Скорость ×{v}',
        'btn.demo': 'Пример',
        'btn.back': '◀ 10 с',
        'btn.fwd': '10 с ▶',
        'btn.close': 'Закрыть',
        'verb.pick': 'Вскрыть',
        'verb.lock': 'Запереть',
        'verb.open': 'Открыть',
        'verb.close': 'Закрыть',
        'verb.smash': 'Разбить',
        'verb.blow': 'Взорвать',
        'verb.rob': 'Забрать',
        'verb.disable': 'Отключить',
        'verb.enable': 'Включить',
        'verb.freeze': 'FREEZE',
        'type.door': 'дверь', 'type.case': 'витрина', 'type.box': 'ячейка', 'type.desk': 'стол',
        'type.sink': 'раковина', 'type.till': 'касса', 'type.safe': 'сейф', 'type.vault': 'хранилище',
        'type.painting': 'картина', 'type.alarm': 'пульт', 'type.team': 'все',
        'result.escaped': 'Ушли! Время {t}. Добыча £{take}.',
        'result.caught': 'Провал: {by} в {t}.',
        'result.timeout': 'Время вышло.',
        'by.patrol': 'патруль увидел банду',
        'by.police': 'приехала полиция',
        'split': '{name}: £{v}',
        'ev.alarm': '{t} тревога ({why})',
        'ev.blocked': '{t} {who}: заперто',
        'ev.rob': '{t} {who} забрал £{v}',
        'ev.knocked-out': '{t} {who} выбит на {s} с',
        'ev.guard-out': '{t} {who} вырубил охранника',
        'ev.spotted': '{t} {who} замечен',
        'ev.rob-closed': '{t} {who}: закрыто, не взять',
        'ev.tripped': '{t} {who} задел {circuit}',
        'ev.disable': '{t} {who} отключил {circuit}',
        'ev.freeze': '{t} FREEZE',
        'ev.patrol': '{t} едет патруль',
        'ev.getaway': '{t} машина ушла',
        'ev.caught': '{t} взяли'
    },

    t(key, vars) {
        let s = HeistText.ru[key] || key;
        if (vars) for (const [k, v] of Object.entries(vars)) s = s.split('{' + k + '}').join(String(v));
        return s;
    },

    clock(sec) {
        const s = Math.max(0, Math.floor(sec));
        return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    },

    money(v) { return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); },

    shortName(id) {
        const p = HeistRules.person(id);
        return p ? p.name.split(' ')[0] : id;
    }
};
