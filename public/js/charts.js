import Chart from 'https://cdn.jsdelivr.net/npm/chart.js@4.5.1/auto/+esm';

Chart.defaults.font.family = 'DM Sans, system-ui, sans-serif';
Chart.defaults.color = '#8492a5';
const charts = new Map();
const orange = '#f36c51', blue = '#508ce0', gold = '#f5a640';
const borderGrid = { color: 'rgba(30, 56, 91, .07)' };
const fmt = v => typeof v === 'number' ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : v;
function make(id, config) {
  const canvas = document.getElementById(id);
  charts.get(id)?.destroy();
  charts.set(id, new Chart(canvas, config));
}
const options = (more = {}) => ({ responsive: true, maintainAspectRatio: false,
  interaction: { intersect: false, mode: 'index' },
  plugins: { legend: { display: false }, tooltip: { callbacks: { label: item => `${item.dataset.label || ''}: ${fmt(item.parsed?.y ?? item.parsed)}` } } },
  scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 8, maxRotation: 0, color:'#93a0b1', font: {size:10} } },
    y: { beginAtZero: true, grid: borderGrid, ticks: { color:'#93a0b1', font: {size:10}, precision:0 } } }, ...more });
function lineData(label, values, color, fill = false) {
  return { label, data: values, borderColor: color, backgroundColor: fill ? 'rgba(243,108,81,.09)' : color,
    fill, tension:.35, pointRadius:0, pointHoverRadius:5, borderWidth:2.5, spanGaps:false };
}
export function renderCharts(data) {
  const dates = data.trends.map(d => d.date.slice(5));
  make('trendChart', { type:'line', data:{ labels:dates, datasets:[lineData('Detections',data.trends.map(d => d.count),orange,true)] }, options: options() });
  make('satelliteChart',{type:'bar',data:{labels:data.satellites.map(d => d.name),datasets:[{label:'Detections',data:data.satellites.map(d => d.count),backgroundColor:['#f36c51','#efa244','#509add','#61bcb5','#a699ea'],borderRadius:5,maxBarThickness:40}]},options:options({indexAxis:'y',scales:{x:{beginAtZero:true,grid:borderGrid,ticks:{precision:0,font:{size:10}}},y:{grid:{display:false},ticks:{font:{size:11}}}}})});
  const u = data.meta?.units || {};
  make('scatterChart',{type:'scatter',data:{datasets:[{label:'Matched detections',data:data.scatter.map(p=>({x:p.temperature,y:p.brightness})),backgroundColor:'rgba(242,110,77,.58)',borderColor:orange,pointRadius:3.2,pointHoverRadius:5.5}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`Temperature: ${fmt(c.parsed.x)} ${u.temperature||''}; Brightness: ${fmt(c.parsed.y)} ${u.brightness||''}`}}},scales:{x:{title:{display:true,text:`Temperature ${u.temperature||'(source units)'}`,font:{size:10}},grid:borderGrid,ticks:{font:{size:10}}},y:{title:{display:true,text:`Brightness ${u.brightness||'(source units)'}`,font:{size:10}},grid:borderGrid,ticks:{font:{size:10}}}}}});
  const bucketOrder = ['High','Nominal','Low','Other','Unknown'];
  const conf = [...data.confidence].sort((a,b)=>bucketOrder.indexOf(a.label)-bucketOrder.indexOf(b.label));
  make('confidenceChart',{type:'doughnut',data:{labels:conf.map(d=>d.label),datasets:[{data:conf.map(d=>d.count),backgroundColor:conf.map(d=>({High:'#f35b55',Nominal:'#f1a045',Low:'#edcf75',Other:'#9780d6',Unknown:'#91a3b9'})[d.label]||'#91a3b9'),borderWidth:0,hoverOffset:5}]},options:{responsive:true,maintainAspectRatio:false,cutout:'71%',plugins:{legend:{display:true,position:'right',labels:{usePointStyle:true,boxWidth:8,font:{size:11}}},tooltip:{callbacks:{label:c=>`${c.label}: ${fmt(c.parsed)}`}}}}});
}
export function renderComparison(areaA, dataA, areaB, dataB, metric) {
  const days = [...new Set([...dataA.trends.map(x=>x.date),...dataB.trends.map(x=>x.date)])].sort();
  const a = new Map(dataA.trends.map(d=>[d.date,d[metric]]));
  const b = new Map(dataB.trends.map(d=>[d.date,d[metric]]));
  const tempOrBright = metric !== 'count';
  const unit = tempOrBright ? (metric==='avgTemperature' ? dataA.meta.units.temperature : dataA.meta.units.brightness) : '';
  const conf = options({ plugins:{ legend:{display:false},tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${c.parsed.y==null?'no data':fmt(c.parsed.y)} ${unit||''}`}} },
    scales:{x:{grid:{display:false},ticks:{maxTicksLimit:12,maxRotation:0}},y:{beginAtZero:!tempOrBright,grid:borderGrid,ticks:{font:{size:10}}}} });
  make('compareChart',{type:'line',data:{labels:days.map(d=>d.slice(5)),datasets:[lineData(areaA,days.map(d=>a.get(d)??null),orange),lineData(areaB,days.map(d=>b.get(d)??null),blue)]},options:conf});
}
