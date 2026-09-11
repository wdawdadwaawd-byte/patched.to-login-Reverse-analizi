const data = require("./strings_full.json");
Object.keys(data).forEach(k => {
    const v = data[k];
    if (v && typeof v === "string" && v.length > 0) {
        const lv = v.toLowerCase();
        if (lv.includes("site") || lv.includes("sitekey") || v === "sk" || v === "wid" || v === "cnt" || v === "widgetId" || v === "siteKey") {
            console.log(k + ": " + JSON.stringify(v));
        }
    }
});
