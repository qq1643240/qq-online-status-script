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
  var list = [];

  function $(id) { return document.getElementById(id); }
  function status(m) { var s = $('st'); if (s) s.textContent = m; }
  function toast(m) {
    var t = document.createElement('div');
    t.textContent = m;
    t.style.cssText = 'position:fixed;left:50%;top:14%;transform:translateX(-50%);background:rgba(0,0,0,.82);color:#fff;padding:10px 16px;border-radius:8px;font-size:14px;z-index:99999;max-width:84%;text-align:center';
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }

  // 原生把机型列表回调到这里
  window.QZPhoneTagJSInterface = window.QZPhoneTagJSInterface || {};
  window.QZPhoneTagJSInterface.onReceive = function (e) {
    try {
      if (e && Number(e.code) === 0 && e.data) {
        list = e.data;
        render();
        status('机型列表已加载（共 ' + list.length + ' 项）。点某个机型=直接保存该机型');
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

  // 核心：保存某个机型（保留其真实ID，服务器才认）
  function apply(item, hide) {
    if (!item) { toast('请先在下方点一个机型'); return; }
    var d = JSON.parse(JSON.stringify(item));
    var diy = ($('diy') && $('diy').value.trim()) || '';
    var force = $('force') && $('force').checked;
    if (hide) {
      d.iDeviceType = 3; d.strDeviceTail = '不显示'; d.strDiyMemo = '';
    } else if (force && diy) {
      // 实验性：强行改机型名（多数会被服务器按ID还原，仅供测试）
      d.strDeviceTail = diy; if (d.iDeviceType === 3) d.iDeviceType = 0; d.strDiyMemo = '';
    } else {
      // 自定义文字（需黄钻，≤10字），叠加在机型前
      d.strDiyMemo = diy;
      if (d.iDeviceType === 3) d.iDeviceType = 0;
    }
    d.iChooseTag = 1;
    d.iOpMask = 0;
    try {
      window.mqq.invoke('Qzone', 'SetUserTail', d);
      toast('已提交: ' + (d.strDiyMemo ? d.strDiyMemo + ' ' : '') + d.strDeviceTail + ' → 发条新说说查看');
    } catch (e) { toast('保存失败: ' + e); }
  }

  function tag(it) {
    var s = '';
    if (it.iChooseTag) s += ' [当前]';
    if (it.iOpMask > 1) s += ' [需黄钻]';
    return s;
  }

  function render() {
    var box = $('list'); if (!box) return;
    box.innerHTML = '';
    list.forEach(function (it) {
      var b = document.createElement('button');
      b.textContent = it.strDeviceTail + tag(it);
      b.style.cssText = 'display:block;width:100%;text-align:left;padding:11px 12px;margin:6px 0;border:1px solid ' + (it.iChooseTag ? '#07c160' : '#ddd') + ';border-radius:8px;background:#fff;font-size:14px;color:#333';
      b.onclick = function () { apply(it, false); };
      box.appendChild(b);
    });
  }

  function build() {
    if (!document.body) { return setTimeout(build, 50); }
    document.body.style.cssText = 'margin:0;padding:16px;font-family:-apple-system,system-ui;background:#f5f5f5;color:#333';
    document.body.innerHTML =
      '<h3 style="margin:0 0 8px">QQ机型小尾巴工具</h3>' +
      '<div id="st" style="font-size:12px;color:#888;margin-bottom:12px">初始化...</div>' +
      '<div style="font-size:13px;font-weight:600;margin-bottom:4px">① 换成列表里的机型（最稳）</div>' +
      '<div style="font-size:12px;color:#888;margin-bottom:6px">点一下即直接保存为该机型，[需黄钻]的项非会员可能无效：</div>' +
      '<div id="list" style="margin-bottom:16px"></div>' +
      '<div style="font-size:13px;font-weight:600;margin-bottom:4px">② 自定义文字（需黄钻，≤10字）</div>' +
      '<input id="diy" maxlength="10" placeholder="如 17PM（会叠加在机型前）" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:14px;margin-bottom:8px" />' +
      '<label style="display:block;font-size:12px;color:#c00;margin-bottom:10px"><input type="checkbox" id="force" /> 实验：强行把机型名改成上面文字（多数会被服务器还原）</label>' +
      '<button id="hide" style="width:100%;padding:12px;border:0;border-radius:8px;background:#888;color:#fff;font-size:15px">设为“不显示”</button>';
    $('hide').onclick = function () {
      var cur = list.filter(function (x) { return x.iChooseTag; })[0] || list[0];
      apply(cur, true);
    };
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
