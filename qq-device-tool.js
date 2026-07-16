/*
 * Shadowrocket HTTP-Request 脚本（返回自造页面，绕过 QQ 离线包）
 * 原理：请求 h5.qzone.qq.com 下一个不存在的路径 /qqtool，离线包里没有 -> 走网络 ->
 *      Shadowrocket 拦截并直接返回下面这个 HTML 工具页。页面在 qq.com 域下，
 *      拥有 mqq 原生桥权限，可直接 GetDeviceInfo / SetUserTail 修改机型。
 * 用法：手机QQ 内浏览器打开  https://h5.qzone.qq.com/qqtool
 * 匹配：^https?://h5.qzone.qq.com/qqtool
 * MITM hostname：h5.qzone.qq.com
 */

// ===== 工具页内运行的代码 =====
function pageCode2() {
  var DEFAULT = 'iPhone 17 Pro Max';
  var list = [], template = null;

  function $(id) { return document.getElementById(id); }
  function status(m) { var s = $('st'); if (s) s.textContent = m; }
  function toast(m) {
    var t = document.createElement('div');
    t.textContent = m;
    t.style.cssText = 'position:fixed;left:50%;top:16%;transform:translateX(-50%);background:rgba(0,0,0,.8);color:#fff;padding:10px 16px;border-radius:8px;font-size:14px;z-index:99999;max-width:82%;text-align:center';
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2400);
  }

  // 原生把机型列表回调到这里
  window.QZPhoneTagJSInterface = window.QZPhoneTagJSInterface || {};
  window.QZPhoneTagJSInterface.onReceive = function (e) {
    try {
      if (e && Number(e.code) === 0 && e.data) {
        list = e.data;
        template = list.filter(function (x) { return x.iChooseTag; })[0] || list[0];
        render();
        status('机型列表已加载（共 ' + list.length + ' 项）');
      } else {
        status('获取列表失败: ' + JSON.stringify(e));
      }
    } catch (err) { status('解析失败: ' + err); }
  };

  function ready(cb) {
    if (window.mqq && window.mqq.invoke) return cb();
    setTimeout(function () { ready(cb); }, 50);
  }
  ready(function () {
    status('正在获取机型列表...');
    try { window.mqq.invoke('Qzone', 'GetDeviceInfo', {}); }
    catch (e) { status('调用 GetDeviceInfo 失败: ' + e); }
  });

  function doSet(name, hide) {
    var tpl = template || list[0];
    if (!tpl) { toast('列表未就绪，请稍候或先点下方任意机型'); return; }
    var d = JSON.parse(JSON.stringify(tpl));
    if (hide) { d.iDeviceType = 3; d.strDeviceTail = '不显示'; }
    else { d.strDeviceTail = name || d.strDeviceTail; if (d.iDeviceType === 3) d.iDeviceType = 0; }
    d.iChooseTag = 1;
    d.iOpMask = 0;
    if (d.strDiyMemo === undefined) d.strDiyMemo = '';
    try {
      window.mqq.invoke('Qzone', 'SetUserTail', d);
      toast('已提交: ' + (hide ? '不显示' : d.strDeviceTail) + '（对新动态生效）');
    } catch (e) { toast('保存失败: ' + e); }
  }

  function render() {
    var box = $('list'); if (!box) return;
    box.innerHTML = '';
    list.forEach(function (it) {
      var b = document.createElement('button');
      b.textContent = it.strDeviceTail + (it.iChooseTag ? '  ✓' : '');
      b.style.cssText = 'display:block;width:100%;text-align:left;padding:10px 12px;margin:6px 0;border:1px solid #ddd;border-radius:8px;background:#fff;font-size:14px;color:#333';
      b.onclick = function () { template = JSON.parse(JSON.stringify(it)); toast('已选模板: ' + it.strDeviceTail); };
      box.appendChild(b);
    });
  }

  function build() {
    if (!document.body) { return setTimeout(build, 50); }
    document.body.style.cssText = 'margin:0;padding:16px;font-family:-apple-system,system-ui;background:#f5f5f5;color:#333';
    document.body.innerHTML =
      '<h3 style="margin:0 0 8px">QQ机型小尾巴工具</h3>' +
      '<div id="st" style="font-size:12px;color:#888;margin-bottom:10px">初始化...</div>' +
      '<input id="inp" placeholder="输入任意机型，如 iPhone 17 Pro Max" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:14px;margin-bottom:8px" />' +
      '<div style="display:flex;gap:8px;margin-bottom:14px">' +
        '<button id="save" style="flex:1;padding:12px;border:0;border-radius:8px;background:#07c160;color:#fff;font-size:15px">应用并保存</button>' +
        '<button id="hide" style="padding:12px 16px;border:0;border-radius:8px;background:#888;color:#fff;font-size:15px">不显示</button>' +
      '</div>' +
      '<div style="font-size:12px;color:#888;margin-bottom:6px">下方为你账号真实机型列表，可先点一个作模板再改名：</div>' +
      '<div id="list"></div>';
    $('inp').value = DEFAULT;
    $('save').onclick = function () { doSet($('inp').value.trim(), false); };
    $('hide').onclick = function () { doSet('', true); };
    render();
  }
  build();
}

// ===== Shadowrocket 侧：直接返回工具页 HTML =====
var TOOL_JS = '(' + pageCode2.toString() + ')();';
var html = [
  '<!doctype html><html><head>',
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">',
  '<title>机型工具</title></head><body>',
  '<script src="https://pub.idqqimg.com/qqmobile/qqapi.wk.js"></scr' + 'ipt>',
  '<script>' + TOOL_JS + '</scr' + 'ipt>',
  '</body></html>'
].join('');

$done({
  response: {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    body: html
  }
});
