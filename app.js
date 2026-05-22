const data = window.NAME_STATS_DATA;
const chapters = data.chapters;
const characters = data.characters;
const generationOrder = [...new Set(characters.map((person) => person.generation))];
const maxCellValue = Math.max(...characters.flatMap((person) => person.counts));

const state = {
  query: "",
  gender: "all",
  generation: "all",
  sort: "total",
  selectedId: [...characters].sort((a, b) => b.total - a.total)[0].id,
};

const els = {
  factPeople: document.querySelector("#fact-people"),
  factChapters: document.querySelector("#fact-chapters"),
  kpis: document.querySelector("#kpi-grid"),
  search: document.querySelector("#search-input"),
  gender: document.querySelector("#gender-filter"),
  sort: document.querySelector("#sort-select"),
  tabs: document.querySelector("#generation-tabs"),
  chapterSummary: document.querySelector("#chapter-summary"),
  chapterChart: document.querySelector("#chapter-chart"),
  rankingSummary: document.querySelector("#ranking-summary"),
  ranking: document.querySelector("#ranking-list"),
  generationBars: document.querySelector("#generation-bars"),
  personPanel: document.querySelector("#person-panel"),
  heatmapSummary: document.querySelector("#heatmap-summary"),
  heatmapTable: document.querySelector("#heatmap-table"),
};

function formatNumber(value) {
  return Number(value).toLocaleString("zh-CN");
}

function filteredCharacters() {
  const query = state.query.trim().toLowerCase();
  const list = characters.filter((person) => {
    const matchesQuery = !query || person.name.toLowerCase().includes(query);
    const matchesGender = state.gender === "all" || person.gender === state.gender;
    const matchesGeneration = state.generation === "all" || person.generation === state.generation;
    return matchesQuery && matchesGender && matchesGeneration;
  });

  return list.sort((a, b) => {
    if (state.sort === "peak") return b.peakValue - a.peakValue || b.total - a.total;
    if (state.sort === "generation") {
      return (
        generationOrder.indexOf(a.generation) - generationOrder.indexOf(b.generation) ||
        b.total - a.total
      );
    }
    if (state.sort === "last") return (b.lastChapter || 0) - (a.lastChapter || 0) || b.total - a.total;
    return b.total - a.total;
  });
}

function metricFor(list) {
  const total = list.reduce((sum, person) => sum + person.total, 0);
  const male = list.reduce((sum, person) => sum + person.maleCount, 0);
  const female = list.reduce((sum, person) => sum + person.femaleCount, 0);
  const chapterTotals = chapters.map((_, index) =>
    list.reduce((sum, person) => sum + person.counts[index], 0),
  );
  const peakChapterValue = Math.max(...chapterTotals, 0);
  const peakChapter = peakChapterValue ? chapters[chapterTotals.indexOf(peakChapterValue)] : "--";
  const topPerson = [...list].sort((a, b) => b.total - a.total)[0];

  return { total, male, female, chapterTotals, peakChapter, peakChapterValue, topPerson };
}

function ensureSelected(list) {
  if (!list.some((person) => person.id === state.selectedId)) {
    state.selectedId = list[0]?.id || characters[0].id;
  }
}

function renderTabs() {
  const tabs = ["all", ...generationOrder];
  els.tabs.innerHTML = tabs
    .map((generation) => {
      const label = generation === "all" ? "全部代际" : generation;
      return `<button type="button" role="tab" aria-selected="${state.generation === generation}" data-generation="${generation}">${label}</button>`;
    })
    .join("");
}

function renderKpis(list, metrics) {
  els.factPeople.textContent = characters.length;
  els.factChapters.textContent = chapters.length;
  const topName = metrics.topPerson ? metrics.topPerson.name : "--";
  els.kpis.innerHTML = [
    ["总提及次数", formatNumber(metrics.total), `${list.length} 个筛选结果`, "accent-blue"],
    ["最活跃人物", topName, `${metrics.topPerson?.total ? formatNumber(metrics.topPerson.total) : "--"} 次`, "accent-teal"],
    ["章节峰值", `第 ${metrics.peakChapter} 章`, `${formatNumber(metrics.peakChapterValue)} 次提及`, "accent-coral"],
    ["性别提及", `${formatNumber(metrics.male)} / ${formatNumber(metrics.female)}`, "男 / 女", "accent-gold"],
  ]
    .map(
      ([label, value, note, accent]) => `
        <article class="kpi-card ${accent}">
          <strong>${label}</strong>
          <span class="value">${value}</span>
          <small>${note}</small>
        </article>
      `,
    )
    .join("");
}

function renderChapterChart(list, metrics) {
  const values = metrics.chapterTotals;
  const maxValue = Math.max(...values, 1);
  const width = 920;
  const height = 260;
  const pad = { top: 22, right: 22, bottom: 36, left: 44 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const points = values.map((value, index) => {
    const x = pad.left + (innerWidth * index) / Math.max(values.length - 1, 1);
    const y = pad.top + innerHeight - (value / maxValue) * innerHeight;
    return { x, y, value, chapter: chapters[index] };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${pad.left},${pad.top + innerHeight} ${line} ${pad.left + innerWidth},${pad.top + innerHeight}`;
  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const y = pad.top + innerHeight - ratio * innerHeight;
      return `<line class="chart-grid" x1="${pad.left}" y1="${y}" x2="${pad.left + innerWidth}" y2="${y}"></line>`;
    })
    .join("");
  const labels = points
    .filter((_, index) => index % 2 === 0 || index === points.length - 1)
    .map(
      (point) =>
        `<text class="axis-label" x="${point.x}" y="${height - 10}" text-anchor="middle">${point.chapter}</text>`,
    )
    .join("");
  const circles = points
    .map(
      (point) =>
        `<circle cx="${point.x}" cy="${point.y}" r="4.2" fill="#ffffff" stroke="#1f63a6" stroke-width="2"><title>第 ${point.chapter} 章：${point.value} 次</title></circle>`,
    )
    .join("");

  els.chapterSummary.textContent = `${list.length} 个对象，合计 ${formatNumber(metrics.total)} 次提及`;
  els.chapterChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="各章节人物提及次数趋势">
      ${grid}
      <text class="axis-label" x="${pad.left - 8}" y="${pad.top + 4}" text-anchor="end">${formatNumber(maxValue)}</text>
      <text class="axis-label" x="${pad.left - 8}" y="${pad.top + innerHeight + 4}" text-anchor="end">0</text>
      <polygon class="area-path" points="${area}"></polygon>
      <polyline class="line-path" points="${line}"></polyline>
      ${circles}
      ${labels}
    </svg>
  `;
}

function renderRanking(list) {
  const top = [...list].sort((a, b) => b.total - a.total).slice(0, 8);
  const maxTotal = Math.max(...top.map((person) => person.total), 1);
  els.rankingSummary.textContent = top.length ? `Top ${top.length} / ${list.length}` : "无匹配结果";
  els.ranking.innerHTML = top
    .map((person, index) => {
      const percent = Math.max((person.total / maxTotal) * 100, 2);
      return `
        <div class="rank-row" data-person-id="${person.id}">
          <span class="rank-number">${index + 1}</span>
          <div class="rank-meta">
            <div class="rank-name">${person.name}</div>
            <div class="rank-sub">${person.generation} · 峰值第 ${person.peakChapter || "--"} 章</div>
            <div class="bar-track"><div class="bar-fill" style="width:${percent}%"></div></div>
          </div>
          <div class="rank-value">${formatNumber(person.total)}</div>
        </div>
      `;
    })
    .join("");
}

function renderGenerationBars(list) {
  const rows = generationOrder.map((generation) => {
    const total = list
      .filter((person) => person.generation === generation)
      .reduce((sum, person) => sum + person.total, 0);
    return { generation, total };
  });
  const maxTotal = Math.max(...rows.map((row) => row.total), 1);
  els.generationBars.innerHTML = rows
    .map((row) => {
      const percent = Math.max((row.total / maxTotal) * 100, row.total ? 2 : 0);
      return `
        <div class="generation-row">
          <span class="generation-name">${row.generation}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${percent}%"></div></div>
          <span class="generation-value">${formatNumber(row.total)}</span>
        </div>
      `;
    })
    .join("");
}

function sparkline(person) {
  const width = 460;
  const height = 94;
  const pad = 8;
  const maxValue = Math.max(...person.counts, 1);
  const points = person.counts.map((value, index) => {
    const x = pad + ((width - pad * 2) * index) / Math.max(person.counts.length - 1, 1);
    const y = pad + (height - pad * 2) - (value / maxValue) * (height - pad * 2);
    return { x, y, value };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${person.name} 的章节趋势">
      <polyline points="${line}" fill="none" stroke="#16877f" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>
      ${points
        .map(
          (point, index) =>
            `<circle cx="${point.x}" cy="${point.y}" r="3" fill="#ffffff" stroke="#16877f" stroke-width="1.8"><title>第 ${chapters[index]} 章：${point.value} 次</title></circle>`,
        )
        .join("")}
    </svg>
  `;
}

function renderPersonPanel(list) {
  const person = characters.find((item) => item.id === state.selectedId) || list[0];
  if (!person) {
    els.personPanel.innerHTML = "<h2>人物详情</h2><p>无匹配结果</p>";
    return;
  }
  els.personPanel.innerHTML = `
    <div class="person-title">
      <div>
        <h2>${person.name}</h2>
        <div class="tags">
          <span class="tag">${person.generation}</span>
          <span class="tag ${person.gender === "男" ? "gender-male" : "gender-female"}">${person.gender}</span>
        </div>
      </div>
    </div>
    <div class="person-stats">
      <div><strong>${formatNumber(person.total)}</strong><span>总提及</span></div>
      <div><strong>${person.peakValue}</strong><span>第 ${person.peakChapter || "--"} 章峰值</span></div>
      <div><strong>${person.firstChapter || "--"}-${person.lastChapter || "--"}</strong><span>出现跨度</span></div>
    </div>
    <div class="sparkline">${sparkline(person)}</div>
  `;
}

function heatColor(value) {
  if (!value) return "background:#f7fafc;color:#9aa6b5";
  const ratio = value / maxCellValue;
  const alpha = 0.12 + ratio * 0.78;
  const color = ratio > 0.58 ? "#ffffff" : "#17324f";
  return `background:rgba(31,99,166,${alpha.toFixed(3)});color:${color}`;
}

function renderHeatmap(list) {
  els.heatmapSummary.textContent = `${list.length} 行，${chapters.length} 个章节列`;
  const head = `
    <thead>
      <tr>
        <th>代际</th>
        <th>人物</th>
        ${chapters.map((chapter) => `<th>${chapter}</th>`).join("")}
        <th>总计</th>
      </tr>
    </thead>
  `;
  const body = list
    .map(
      (person) => `
        <tr class="${person.id === state.selectedId ? "is-selected" : ""}">
          <td>${person.generation}</td>
          <td class="person-cell" data-person-id="${person.id}">${person.name}</td>
          ${person.counts
            .map(
              (value, index) =>
                `<td class="heat-cell" style="${heatColor(value)}" title="${person.name} · 第 ${chapters[index]} 章：${value} 次">${value || ""}</td>`,
            )
            .join("")}
          <td class="total-cell">${formatNumber(person.total)}</td>
        </tr>
      `,
    )
    .join("");
  els.heatmapTable.innerHTML = `${head}<tbody>${body}</tbody>`;
}

function render() {
  renderTabs();
  const list = filteredCharacters();
  ensureSelected(list);
  const metrics = metricFor(list);
  renderKpis(list, metrics);
  renderChapterChart(list, metrics);
  renderRanking(list);
  renderGenerationBars(list);
  renderPersonPanel(list);
  renderHeatmap(list);
}

els.search.addEventListener("input", (event) => {
  state.query = event.target.value;
  render();
});

els.gender.addEventListener("change", (event) => {
  state.gender = event.target.value;
  render();
});

els.sort.addEventListener("change", (event) => {
  state.sort = event.target.value;
  render();
});

els.tabs.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-generation]");
  if (!button) return;
  state.generation = button.dataset.generation;
  render();
});

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-person-id]");
  if (!target) return;
  state.selectedId = target.dataset.personId;
  render();
});

render();
