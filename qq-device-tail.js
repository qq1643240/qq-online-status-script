/*
 * Shadowrocket HTTP-Response 脚本
 * 作用：在 QQ空间「手机标识 / 小尾巴」设置页注入一个自定义面板，
 *      劫持 mqq.invoke 的 SetUserTail，实现设置任意机型 / 不显示，且免黄钻。
 * 原理：该页面在 *.qq.com 域下，天然拥有 mqq 原生桥权限；
 *      原生端信任 H5 传入的 strDeviceTail 字符串，故可任意改写。
 * 不需要任何 cookie，用的是 QQ 自身登录态。
 *
 * 匹配：^https?://h5.qzone.qq.com/v2/vip/show/tail
 * MITM hostname：h5.qzone.qq.com
 */

// ============ 注入到页面里执行的代码 ============
function pageCode() {
  if (window.__qqDeviceHooked) return;
  window.__qqDeviceHooked = true;

  // ====== 可配置项：想改机型只改这里 ======
  var CONFIG = {
    AUTO_APPLY: true,                    // true=进页面自动写入；false=只显示面板手动点
    TARGET_DEVICE: 'iPhone 17 Pro Max',  // 目标机型名（自动写入用）
    TARGET_HIDE: false                   // true=自动设为"不显示"（此时忽略上面机型名）
  };
  // =======================================

  var state = { custom: '', hide: false };
  var template = null;   // 一个真实机型对象，用作 SetUserTail 的模板
  var list = [];
  var autoDone = false;

  // 模板/列表就绪后自动写入（每次页面加载只触发一次）
  function maybeAuto() {
    if (!CONFIG.AUTO_APPLY || autoDone) return;
    if (!template && !(list && list[0])) return;
    if (!window.mqq || !window.mqq.invoke) return;
    autoDone = true;
    state.hide = !!CONFIG.TARGET_HIDE;
    state.custom = CONFIG.TARGET_DEVICE;
    setTimeout(function () { applyNow(); }, 300);
  }

  // 1) 捕获机型列表：包装 QZPhoneTagJSInterface.onReceive
  var wrapTimer = setInterval(function () {
    try {
      var it = window.QZPhoneTagJSInterface;
      if (it && !it.__wrapped) {
        it.__wrapped = true;
        var current = it.onReceive;
        Object.defineProperty(it, 'onReceive', {
          configurable: true,
          get: function () { return this.__cb; },
          set: function (fn) {
            this.__cb = function (e) {
              try {
                if (e && Number(e.code) === 0 && e.data) {
                  list = e.data;
                  var chosen = list.filter(function (x) { return x.iChooseTag; })[0] || list[0];
                  if (chosen) template = JSON.parse(JSON.stringify(chosen));
                  maybeAuto();
                }
              } catch (err) {}
              return fn && fn.apply(this, arguments);
            };
          }
        });
        if (current) { it.onReceive = current; }
      }
    } catch (e) {}
  }, 50);
  setTimeout(function () { clearInterval(wrapTimer); }, 15000);

  // 2) 包装 mqq.invoke：拦截 SetUserTail（官方"保存"按钮也会被改写）
  function hookInvoke() {
    if (!window.mqq || !window.mqq.invoke) { return setTimeout(hookInvoke, 50); }
    if (window.mqq.__invHooked) return;
    window.mqq.__invHooked = true;
    var raw = window.mqq.invoke.bind(window.mqq);
    window.mqq.invoke = function (mod, method, data, cb) {
      try {
        if (mod === 'Qzone' && method === 'GetDeviceInfo') {
          setTimeout(maybeAuto, 600); // 请求列表后尝试自动写入
        }
        if (mod === 'Qzone' && method === 'SetUserTail' && data) {
          template = JSON.parse(JSON.stringify(data)); // 顺手留作模板
          if (state.hide) {
            data.iDeviceType = 3;
            data.strDeviceTail = '不显示';
          } else if (state.custom) {
            data.strDeviceTail = state.custom;
            if (data.iDeviceType === 3) data.iDeviceType = 0;
          }
          data.iChooseTag = 1;
          data.iOpMask = 0; // 清除黄钻掩码
        }
      } catch (e) {}
      return raw(mod, method, data, cb);
    };
  }
  hookInvoke();

  // 3) 主动保存（不依赖官方保存按钮）
  function applyNow() {
    var tpl = template || list[0];
    if (!tpl) { toast('机型列表未就绪：请在下方官方列表点一下任意机型后再试'); return; }
    var d = JSON.parse(JSON.stringify(tpl));
    if (state.hide) {
      d.iDeviceType = 3; d.strDeviceTail = '不显示';
    } else {
      d.strDeviceTail = state.custom || d.strDeviceTail;
      if (d.iDeviceType === 3) d.iDeviceType = 0;
    }
    d.iChooseTag = 1;
    d.iOpMask = 0;
    if (d.strDiyMemo === undefined) d.strDiyMemo = '';
    if (window.mqq && window.mqq.invoke) {
      window.mqq.invoke('Qzone', 'SetUserTail', d);
      toast('已提交：' + (state.hide ? '不显示' : d.strDeviceTail) + '（对新动态生效）');
    } else {
      toast('mqq 未就绪，请改用官方"保存"按钮');
    }
  }

  // 4) UI
  function toast(msg) {
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;left:50%;top:20%;transform:translateX(-50%);background:rgba(0,0,0,.8);color:#fff;padding:10px 16px;border-radius:8px;font-size:14px;z-index:2147483647;max-width:80%;text-align:center';
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2200);
  }

  function buildUI() {
    if (!document.body) { return setTimeout(buildUI, 50); }
    var box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;background:#fff;border:1px solid #eee;border-radius:14px;box-shadow:0 6px 24px rgba(0,0,0,.18);padding:12px;z-index:2147483647;font-size:14px;color:#333';
    box.innerHTML =
      '<div style="font-weight:600;margin-bottom:8px">自定义机型小尾巴（免黄钻）</div>' +
      '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">' +
        '<input id="qqDevInput" placeholder="输入任意机型，如 iPhone 16 Pro Max" style="flex:1;padding:8px 10px;border:1px solid #ddd;border-radius:8px;font-size:14px" />' +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px" id="qqDevQuick"></div>' +
      '<div style="display:flex;gap:8px">' +
        '<button id="qqDevSave" style="flex:1;padding:10px;border:0;border-radius:8px;background:#07c160;color:#fff;font-size:15px">应用并保存</button>' +
        '<button id="qqDevHide" style="padding:10px 14px;border:0;border-radius:8px;background:#888;color:#fff;font-size:15px">不显示</button>' +
        '<button id="qqDevMin" style="padding:10px 12px;border:0;border-radius:8px;background:#eee;color:#333;font-size:15px">收起</button>' +
      '</div>';
    document.body.appendChild(box);

    var input = box.querySelector('#qqDevInput');
    input.addEventListener('input', function () { state.custom = input.value.trim(); state.hide = false; });

    var quick = ['iPhone 16 Pro Max', 'iPhone 15 Pro', '华为 Mate 70 Pro', '小米 15 Ultra', 'vivo X200 Pro', 'iPad Pro'];
    var qwrap = box.querySelector('#qqDevQuick');
    quick.forEach(function (name) {
      var b = document.createElement('button');
      b.textContent = name;
      b.style.cssText = 'padding:6px 10px;border:1px solid #ddd;border-radius:16px;background:#f7f7f7;font-size:12px;color:#333';
      b.onclick = function () { input.value = name; state.custom = name; state.hide = false; };
      qwrap.appendChild(b);
    });

    box.querySelector('#qqDevSave').onclick = function () { state.hide = false; state.custom = input.value.trim(); applyNow(); };
    box.querySelector('#qqDevHide').onclick = function () { state.hide = true; applyNow(); };
    box.querySelector('#qqDevMin').onclick = function () { box.style.display = 'none'; fab.style.display = 'block'; };

    var fab = document.createElement('div');
    fab.textContent = '机型';
    fab.style.cssText = 'position:fixed;right:12px;bottom:80px;background:#07c160;color:#fff;padding:10px 12px;border-radius:20px;z-index:2147483647;font-size:13px;display:none';
    fab.onclick = function () { box.style.display = 'block'; fab.style.display = 'none'; };
    document.body.appendChild(fab);
  }
  buildUI();
}

// ============ Shadowrocket 侧：把上面的代码注入 HTML ============
var PAGE_SCRIPT = '(' + pageCode.toString() + ')();';

var body = $response.body;
if (typeof body === 'string' && body.indexOf('__QQ_DEVICE_PANEL__') === -1) {
  var inject = '<script id="__QQ_DEVICE_PANEL__">' + PAGE_SCRIPT + '</scr' + 'ipt>';
  if (body.indexOf('</head>') !== -1) {
    body = body.replace('</head>', inject + '</head>');
  } else if (/<body[^>]*>/.test(body)) {
    body = body.replace(/<body[^>]*>/, function (m) { return m + inject; });
  } else {
    body = inject + body;
  }
}

$done({ body: body });
