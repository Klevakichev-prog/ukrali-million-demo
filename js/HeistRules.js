// HeistRules.js — the rules of They Stole a Million as measured in the emulator
// (research/levels/rules.json): the roster, skill tiers, action times, fights, splits.
// Pure data and small helpers, no 3D. HeistModel reads it; tests read it too.

/** @satisfies {Record<string, any>} */
const HeistRules = {
    // Skills of the original: a specialist is a master of skill 1 and trained in skill 2.
    SKILLS: ['safe', 'explosives', 'lock', 'alarms', 'thug', 'lookout', 'driver'],

    // The 18 specialists (names, skills, base fee in pounds, cut of the take in %).
    ROSTER: [
        { id: 'fingers', name: 'Fingers Flanigan', skills: ['safe', 'explosives'], fee: 21000, cut: 15 },
        { id: 'tumbler', name: 'Tumbler Fredriks', skills: ['safe', 'lock'], fee: 20000, cut: 15 },
        { id: 'jelly', name: 'James Jelly Roll', skills: ['explosives', 'lookout'], fee: 11000, cut: 10 },
        { id: 'darcy', name: "Detonator D'Arcy", skills: ['explosives', 'driver'], fee: 17000, cut: 10 },
        { id: 'wires', name: 'Bill Wires Smith', skills: ['alarms', 'driver'], fee: 25000, cut: 10 },
        { id: 'volts', name: 'Charlie Volts', skills: ['alarms', 'thug'], fee: 19000, cut: 10 },
        { id: 'bert', name: 'Bert Bell Davies', skills: ['alarms', 'safe'], fee: 26000, cut: 10 },
        { id: 'chimes', name: 'Harry Chimes', skills: ['alarms', 'lock'], fee: 22000, cut: 15 },
        { id: 'wheels', name: 'Wheels Williams', skills: ['driver', 'thug'], fee: 16000, cut: 15 },
        { id: 'prost', name: 'Adam Prost', skills: ['driver', 'lookout'], fee: 15000, cut: 15 },
        { id: 'nod', name: 'Clint The Nod', skills: ['lookout', 'alarms'], fee: 11000, cut: 5 },
        { id: 'dave', name: 'Big Dave Canon', skills: ['lookout', 'thug'], fee: 4000, cut: 5 },
        { id: 'crusher', name: 'Crusher Jones', skills: ['thug', 'lookout'], fee: 5000, cut: 5 },
        { id: 'madman', name: 'Mad Man Martin', skills: ['thug', 'explosives'], fee: 9000, cut: 5 },
        { id: 'keyhole', name: 'Keyhole Carter', skills: ['lock', 'safe'], fee: 16000, cut: 5 },
        { id: 'skeleton', name: 'Skeleton Joe', skills: ['lock', 'lookout'], fee: 9000, cut: 5 },
        { id: 'clive', name: 'Baby-Face Clive', skills: ['driver', 'lock'], fee: 18000, cut: 10 },
        { id: 'bruiser', name: 'Bruiser Branigan', skills: ['safe', 'thug'], fee: 18000, cut: 10 }
    ],

    DEFAULT_TEAM: ['fingers', 'bert', 'keyhole', 'clive'],

    // Seconds to pick (or lock) the lock of an object by skill tier: [master, trained, none].
    LOCK_TIMES: {
        door: { skill: 'lock', t: [12, 16, 24] },
        desk: { skill: 'lock', t: [8, 12, 16] },
        till: { skill: 'lock', t: [8, 12, 20] },
        sink: { skill: 'lock', t: [8, 12, 20] },
        case: { skill: null, t: [12, 12, 12] },
        box: { skill: null, t: [12, 12, 12] },
        safe: { skill: 'safe', t: [12, 20, 36] },
        vault: { skill: 'safe|lock', t: [16, 24, 44] },
        alarm: { skill: 'alarms', t: [16, 20, 32] }
    },

    // The Boss: fixed times (a trained locksmith), strength and knockout.
    BOSS: { id: 'boss', name: 'The Boss', lock: { door: 16, desk: 12, till: 12, sink: 12, case: 12, box: 12, safe: 20, vault: 24, alarm: 20 },
            strength: 32, knockout: 40 },

    TIMES: { move: 1, open: 2, close: 2, smash: 8, blow: 8, robHeavy: 8, rob: 4, freeze: 15,
             enable: { 0x40: 64, 0x20: 32, 0x80: 128, 0x10: 32 } },
    STRENGTH: [64, 32, 0],          // thug master / trained / none
    CREW_KNOCKOUT: 120,

    // Penalties that remain with every intel of the level bought (see the report):
    // level 2 smash +11 (no hardware intel), level 4 infra-red disable +13 (no diagram),
    // level 5 safe pick and smash +20 (no hardware intel).
    RESIDUAL_PENALTY: { 2: { smash: 11 }, 4: { disable: { 0x80: 13 } }, 5: { smash: 20, safe: 20 } },

    // Which verbs apply to which object type.
    VERBS: {
        door: ['pick', 'lock', 'open', 'close'],
        case: ['pick', 'open', 'close', 'smash', 'rob'],
        box: ['pick', 'open', 'close', 'smash', 'rob'],
        desk: ['pick', 'open', 'close', 'smash', 'rob'],
        sink: ['pick', 'open', 'close', 'smash', 'rob'],
        till: ['pick', 'open', 'close', 'smash', 'rob'],
        safe: ['pick', 'open', 'close', 'blow', 'rob'],
        vault: ['pick', 'open', 'close', 'blow'],
        painting: ['rob'],
        alarm: ['disable', 'enable']
    },

    /** @returns {any} a roster record or the Boss */
    person(id) {
        if (id === 'boss') return HeistRules.BOSS;
        return HeistRules.ROSTER.find(p => p.id === id) || null;
    },

    // Skill tier of a person: 0 master, 1 trained, 2 none.
    tier(person, skill) {
        if (!person || !person.skills) return 2;
        const i = person.skills.indexOf(skill);
        return i < 0 ? 2 : i;
    },

    has(person, skill) { return !!(person && person.skills && person.skills.includes(skill)); },

    strength(person) {
        if (person.id === 'boss') return HeistRules.BOSS.strength;
        return HeistRules.STRENGTH[HeistRules.tier(person, 'thug')];
    },

    knockout(person) { return person.id === 'boss' ? HeistRules.BOSS.knockout : HeistRules.CREW_KNOCKOUT; },

    // Seconds of a verb on an object type for a person on a level (full intel bought).
    // circuit — the panel's circuit bit for disable/enable.
    duration(person, verb, type, level, circuit) {
        const R = HeistRules.RESIDUAL_PENALTY[level] || {};
        if (verb === 'pick' || verb === 'lock' || verb === 'disable') {
            const key = verb === 'disable' ? 'alarm' : type;
            let t;
            if (person.id === 'boss') t = HeistRules.BOSS.lock[key];
            else {
                const lt = HeistRules.LOCK_TIMES[key];
                let tier = 2;
                if (lt.skill) for (const s of lt.skill.split('|')) tier = Math.min(tier, HeistRules.tier(person, s));
                t = lt.t[tier];
            }
            if (verb === 'pick' && type === 'safe' && R.safe) t += R.safe;
            if (verb === 'disable' && R.disable && R.disable[circuit]) t += R.disable[circuit];
            return t;
        }
        const T = HeistRules.TIMES;
        if (verb === 'open' || verb === 'close') return T.open;
        if (verb === 'smash') return T.smash + (R.smash || 0);
        if (verb === 'blow') return T.blow;
        if (verb === 'rob') return (type === 'safe' || type === 'till') ? T.robHeavy : T.rob;
        if (verb === 'enable') return T.enable[circuit] || 64;
        if (verb === 'freeze') return T.freeze;
        return 1;
    },

    // Can the person do the verb at all (skill gates of the original).
    allowed(person, verb) {
        if (verb === 'blow') return person.id !== 'boss' && HeistRules.has(person, 'explosives');
        if (verb === 'freeze') return person.id === 'boss';
        return true;
    },

    // The split: every crew member gets his cut of the take, the Boss the rest.
    split(take, team) {
        const out = {};
        let rest = take;
        for (const id of team) {
            const p = HeistRules.person(id);
            const share = Math.floor(take * p.cut / 100);
            out[id] = share;
            rest -= share;
        }
        out.boss = rest;
        return out;
    }
};
