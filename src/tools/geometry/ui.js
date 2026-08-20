import { siteHeader } from "../../components/siteHeader.js";

const toolButton = (id, label, glyph, shortcut = "") => `
  <button class="geometry-tool" type="button" data-tool="${id}" aria-label="${label}${shortcut ? `（${shortcut}）` : ""}" title="${label}${shortcut ? ` · ${shortcut}` : ""}">
    <span aria-hidden="true">${glyph}</span>
    <small>${label}</small>
  </button>
`;

export const geometryWorkspaceMarkup = () => `
  ${siteHeader({ basePath: "../..", currentPage: "tools", variant: "workspace" })}
  <main id="top" class="geometry-app" aria-label="几何作图工作区">
    <header class="geometry-commandbar">
      <div class="geometry-command-group">
        <button class="geometry-command" type="button" data-action="new-project" title="新建工程">新建</button>
        <button class="geometry-command" type="button" data-action="undo" title="撤销 · Ctrl+Z">↶</button>
        <button class="geometry-command" type="button" data-action="redo" title="重做 · Ctrl+Y">↷</button>
      </div>
      <label class="geometry-document-title">
        <span class="sr-only">工程名称</span>
        <input id="geometry-title" type="text" maxlength="80" value="未命名作图" aria-label="工程名称" />
        <span id="geometry-save-state" role="status">本地</span>
      </label>
      <div class="geometry-command-group geometry-command-group-end">
        <button class="geometry-command" type="button" data-action="import-image">图片</button>
        <button class="geometry-command" type="button" data-action="open-project">打开</button>
        <button class="geometry-command" type="button" data-action="save-project">工程文件</button>
        <button class="geometry-command geometry-command-primary" type="button" data-action="open-export">导出</button>
        <button class="geometry-command geometry-inspector-toggle" type="button" data-action="toggle-inspector" aria-label="切换属性面板">属性</button>
      </div>
    </header>

    <div class="geometry-workspace">
      <aside class="geometry-toolbar" aria-label="绘图工具">
        <div class="geometry-tool-group">
          ${toolButton("select", "选择", "⌁", "V")}
          ${toolButton("pan", "平移", "✥", "H")}
          ${toolButton("point", "点", "·", "P")}
        </div>
        <div class="geometry-tool-group">
          ${toolButton("segment", "线段", "╱", "L")}
          ${toolButton("ray", "射线", "↗")}
          ${toolButton("infiniteLine", "直线", "⟷")}
          ${toolButton("polyline", "折线", "⌁")}
          ${toolButton("bezier", "曲线", "∿", "B")}
          ${toolButton("arrow", "箭头", "➜")}
        </div>
        <details class="geometry-tool-family">
          <summary title="基础图形"><span aria-hidden="true">◇</span><small>图形</small></summary>
          <div class="geometry-tool-popover">
            ${toolButton("circle", "圆", "○")}
            ${toolButton("ellipse", "椭圆", "⬭")}
            ${toolButton("arc", "圆弧", "◠")}
            ${toolButton("sector", "扇形", "◔")}
            ${toolButton("rect", "矩形", "□")}
            ${toolButton("triangle", "三角形", "△")}
            ${toolButton("polygon", "多边形", "⬠")}
            ${toolButton("regularPolygon", "正多边形", "⬡")}
          </div>
        </details>
        <div class="geometry-tool-group">
          ${toolButton("freehand", "画笔", "✎", "F")}
          ${toolButton("text", "文字", "T", "T")}
          ${toolButton("measure", "测量", "⌇", "M")}
          ${toolButton("eraser", "擦除", "⌫", "E")}
          ${toolButton("exportCrop", "框选导出", "⌗")}
        </div>
      </aside>

      <section id="geometry-stage" class="geometry-stage" tabindex="0" aria-label="几何作图画布">
        <canvas id="geometry-canvas"></canvas>
        <div id="geometry-snap-hint" class="geometry-snap-hint is-hidden" aria-hidden="true"></div>
        <div id="geometry-crop-box" class="geometry-crop-box is-hidden" aria-hidden="true"></div>
        <div id="geometry-empty-guide" class="geometry-empty-guide">
          <strong>从左侧选择工具开始作图</strong>
          <span>滚轮缩放 · 空格拖动画布 · Alt 临时关闭吸附</span>
        </div>
        <div id="geometry-drop-hint" class="geometry-drop-hint is-hidden">松开即可导入图片</div>
        <div id="geometry-toast" class="geometry-toast is-hidden" role="status" aria-live="polite"></div>
      </section>

      <aside id="geometry-inspector" class="geometry-inspector" aria-label="属性面板">
        <div class="geometry-inspector-scroll">
          <section class="inspector-section">
            <header class="inspector-heading">
              <div>
                <span class="inspector-kicker">SELECTION</span>
                <h2 id="inspector-title">未选择对象</h2>
              </div>
              <span id="inspector-count">0</span>
            </header>

            <div id="inspector-empty" class="inspector-empty">选择对象后可调整样式、层级和绑定关系。</div>
            <div id="inspector-object-controls" class="inspector-controls is-hidden">
              <label class="inspector-field inspector-field-wide">
                <span>名称</span>
                <input id="object-name" type="text" maxlength="60" />
              </label>
              <div class="inspector-field-row">
                <label class="inspector-field"><span>描边</span><input id="object-stroke" type="color" /></label>
                <label class="inspector-field"><span>填充</span><input id="object-fill" type="color" /></label>
              </div>
              <div class="inspector-field-row">
                <label class="inspector-field"><span>线宽</span><input id="object-stroke-width" type="number" min="1" max="16" step="1" /></label>
                <label class="inspector-field"><span>线型</span><select id="object-dash"><option value="solid">实线</option><option value="dashed">虚线</option></select></label>
              </div>
              <label class="inspector-field inspector-field-wide">
                <span>透明度 <output id="object-opacity-output">100%</output></span>
                <input id="object-opacity" type="range" min="10" max="100" step="5" />
              </label>
              <div id="arrow-controls" class="inspector-check-row">
                <label><input id="object-arrow-start" type="checkbox" /> 起点箭头</label>
                <label><input id="object-arrow-end" type="checkbox" /> 终点箭头</label>
              </div>
              <div id="text-controls" class="inspector-text-controls is-hidden">
                <div class="inspector-field-row">
                  <label class="inspector-field"><span>字号</span><input id="object-font-size" type="number" min="10" max="96" step="1" /></label>
                  <label class="inspector-field"><span>对齐</span><select id="object-text-align"><option value="left">左</option><option value="center">中</option><option value="right">右</option></select></label>
                </div>
                <div class="inspector-check-row">
                  <label><input id="object-font-bold" type="checkbox" /> 粗体</label>
                  <label><input id="object-font-italic" type="checkbox" /> 斜体</label>
                </div>
              </div>
              <div class="inspector-action-grid">
                <button type="button" data-action="group">组合</button>
                <button type="button" data-action="ungroup">取消组合</button>
                <button type="button" data-action="toggle-node-edit">节点编辑</button>
                <button type="button" data-action="bind-text">绑定文字</button>
              </div>
              <div class="inspector-action-grid inspector-action-grid-four">
                <button type="button" data-action="send-back">置底</button>
                <button type="button" data-action="move-back">下移</button>
                <button type="button" data-action="move-forward">上移</button>
                <button type="button" data-action="bring-front">置顶</button>
              </div>
              <div class="inspector-action-grid">
                <button type="button" data-action="toggle-lock">锁定</button>
                <button type="button" data-action="toggle-hidden">隐藏</button>
                <button class="inspector-danger" type="button" data-action="delete-selection">删除</button>
              </div>
            </div>
          </section>

          <section class="inspector-section inspector-document">
            <header class="inspector-heading inspector-heading-small">
              <div><span class="inspector-kicker">CANVAS</span><h2>画布</h2></div>
            </header>
            <div class="inspector-field-row">
              <label class="inspector-field"><span>网格</span><select id="grid-mode"><option value="line">线网格</option><option value="dot">点网格</option><option value="none">关闭</option></select></label>
              <label class="inspector-field"><span>间距</span><input id="grid-spacing" type="number" min="0.25" max="10" step="0.25" /></label>
            </div>
            <div class="inspector-check-column">
              <label><input id="grid-axes" type="checkbox" /> 显示坐标轴</label>
              <label><input id="grid-snap" type="checkbox" /> 启用吸附</label>
            </div>
            <label class="inspector-field inspector-field-wide">
              <span>文档背景</span>
              <select id="document-background"><option value="white">白色</option><option value="dark">深色</option><option value="transparent">透明</option></select>
            </label>
            <div class="inspector-action-grid">
              <button type="button" data-action="reset-view">复位视图</button>
              <button type="button" data-action="fit-content">适配内容</button>
              <button type="button" data-action="show-all">显示全部对象</button>
            </div>
          </section>
        </div>
      </aside>
    </div>

    <footer class="geometry-statusbar">
      <span id="status-tool">选择</span>
      <span id="status-coordinates">x 0 · y 0</span>
      <span id="status-snap">吸附：开启</span>
      <span id="status-zoom">100%</span>
    </footer>
  </main>

  <dialog id="geometry-export-dialog" class="geometry-dialog">
    <form method="dialog" class="geometry-dialog-content">
      <header><div><span class="inspector-kicker">EXPORT</span><h2>导出作品</h2></div><button value="cancel" aria-label="关闭">×</button></header>
      <label class="inspector-field inspector-field-wide"><span>范围</span><select id="export-scope"><option value="viewport">当前可见区</option><option value="crop">框选区域</option></select></label>
      <label class="inspector-field inspector-field-wide"><span>背景</span><select id="export-background"><option value="current">当前文档背景</option><option value="white">白色</option><option value="dark">深色</option><option value="transparent">透明</option></select></label>
      <div class="inspector-check-column">
        <label><input id="export-grid" type="checkbox" /> 包含网格</label>
        <label><input id="export-axes" type="checkbox" /> 包含坐标轴</label>
      </div>
      <p id="export-crop-note" class="geometry-dialog-note is-hidden">请先使用左侧“框选导出”工具确定范围。</p>
      <div class="geometry-dialog-actions">
        <button class="geometry-command" value="cancel">取消</button>
        <button class="geometry-command" type="button" data-export="clipboard">复制 PNG</button>
        <button class="geometry-command" type="button" data-export="svg">下载 SVG</button>
        <button class="geometry-command geometry-command-primary" type="button" data-export="png">下载 PNG</button>
      </div>
    </form>
  </dialog>
`;
