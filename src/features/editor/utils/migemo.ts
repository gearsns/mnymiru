import * as migemo from 'jsmigemo'

let migemoInstance: migemo.Migemo | null = null;

export async function getMigemo() {
    if (migemoInstance) return migemoInstance;

    const dictData = await fetch("./migemo-compact-dict").then(res => res.arrayBuffer());
    const m = new migemo.Migemo();
    const cd = new migemo.CompactDictionary(dictData);
    m.setDict(cd);
    migemoInstance = m;
    return m;
}
//getMigemo();