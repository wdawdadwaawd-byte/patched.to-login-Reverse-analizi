const data = require("./both_decoded.json");
// alpha2 ile decode edilmiş string'lerde siteKey ara
Object.keys(data).forEach(k => {
    const entry = data[k];
    if (entry && entry.alpha2 && typeof entry.alpha2 === "string") {
        const v = entry.alpha2;
        if (v === "siteKey" || v === "widgetId" || v === "sk" || v === "wid" || v === "cnt" || v.includes("Site") || v.includes("site")) {
            console.log("idx=" + k + ": " + JSON.stringify(v));
        }
    }
});
