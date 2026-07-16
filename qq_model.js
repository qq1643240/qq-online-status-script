// QQ 自定义在线状态 - 改机型（Shadowrocket 端上脚本，无需电脑）
// 功能：无论本机是什么设备（iPhone 12 / 13 ...），都强制显示为 iPhone 17 Pro Max，
//       并在它的全部配色之间轮换：银色 / 宇宙橙 / 深蓝色 / 黑色。
//
// 想换别的机型：把 TARGET_MODEL 改成 iphone_models.json 里的任意代号，
//               TARGET_NAME 改成对应名称即可。
// 想固定某一个颜色：把 COLOR_MODE 改成 "fixed" 并填 FIXED_COLOR。
// 想纯随机：COLOR_MODE 保持 "random"。

const TARGET_MODEL = "iPhone18,2";          // iPhone 17 Pro Max 的设备代号
const TARGET_NAME  = "iPhone 17 Pro Max";   // 展示名前缀
const COLORS = ["银色", "宇宙橙", "深蓝色", "黑色"]; // iPhone 17 Pro Max 全部配色

const COLOR_MODE  = "cycle";   // cycle=轮换 / random=随机 / fixed=固定
const FIXED_COLOR = "宇宙橙";  // 仅 fixed 模式生效

function pickColor() {
    if (COLOR_MODE === "fixed") return FIXED_COLOR;
    if (COLOR_MODE === "random") {
        return COLORS[Math.floor(Math.random() * COLORS.length)];
    }
    // cycle：用持久化存储记住上一次的位置，每次 +1 轮换
    try {
        if (typeof $persistentStore !== "undefined") {
            let idx = parseInt($persistentStore.read("qq_model_idx") || "0", 10);
            if (isNaN(idx)) idx = 0;
            let c = COLORS[idx % COLORS.length];
            $persistentStore.write(String((idx + 1) % COLORS.length), "qq_model_idx");
            return c;
        }
    } catch (e) {}
    return COLORS[Math.floor(Math.random() * COLORS.length)];
}

let body = $request.body;
if (body && body.indexOf("SetCustomOnlineStatus") !== -1) {
    let color = pickColor();
    let show = TARGET_NAME + " (" + color + ")";
    body = body
        .replace(/"sModel"\s*:\s*"[^"]*"/, '"sModel":"' + TARGET_MODEL + '"')
        .replace(/"sModelShow"\s*:\s*"[^"]*"/, '"sModelShow":"' + show + '"');
}
$done({ body });
