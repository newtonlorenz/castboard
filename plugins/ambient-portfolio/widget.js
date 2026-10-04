export async function mount({element,context,config}) {
 const {scope}=await import(context.source('runtime').asset('runtime.js'));
 const {document,request,setInterval}=await scope(element,context,"<div class=\"card portfolio-card\">\n            <div class=\"portfolio-title-line\">\n                <div class=\"card-label\">Portfolio</div>\n                <div id=\"portfolio-ib-status\" class=\"portfolio-gateway-status\">Loading\u2026</div>\n            </div>\n            <div class=\"portfolio-table-wrap\">\n                <table class=\"portfolio-table\">\n                    <thead id=\"portfolio-head\"></thead>\n                    <tbody id=\"portfolio-body\"></tbody>\n                </table>\n                <div id=\"portfolio-total\" class=\"portfolio-total\" style=\"display:none;\">\n                    <div class=\"portfolio-total-block\">\n                        <div class=\"portfolio-total-label\">Total value</div>\n                        <div class=\"portfolio-total-value\" id=\"portfolio-total-value\">--</div>\n                    </div>\n                    <div class=\"portfolio-total-block\">\n                        <div class=\"portfolio-total-label\">Daily +/-</div>\n                        <div class=\"portfolio-total-value\" id=\"portfolio-total-pnl\">--</div>\n                    </div>\n                    <div class=\"portfolio-total-block\">\n                        <div class=\"portfolio-total-label\">Total +/-</div>\n                        <div class=\"portfolio-total-value\" id=\"portfolio-total-total-pnl\">--</div>\n                    </div>\n                </div>\n            </div>\n        </div>",'mission.css');

    // ===== CONFIGURATION =====

    const REFRESH = {"PORTFOLIO": 15000};

    // ===== UTILITY: Fetch with Retry =====

    async function fetchJSON(url, options) { return request(url, options && typeof options === 'object' ? options : {}); }

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>'"]/g, function(ch) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch];
        });
    }

    // ===== UTILITY: Currency symbol =====

    function currencySymbol(code) {
        try { return new Intl.NumberFormat(config.locale || undefined, {style:'currency',currency:code || 'EUR',currencyDisplay:'narrowSymbol'}).formatToParts(0).find(part=>part.type==='currency').value; } catch { return code || ''; }
    }

    // ===== PORTFOLIO =====

    function fmtPrice(val, cs) {
        if (val === null || val === undefined || val === '' || isNaN(Number(val))) return '--';
        val = Number(val);
        if (val >= 10000) return cs + Math.round(val).toLocaleString('en-US');
        return cs + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function fmtUpdatedAt(iso, source) {
        if (!iso) return source ? ('Source: ' + source) : 'Update time unavailable';
        try {
            var d = new Date(iso);
            var time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            return 'Updated ' + time + (source ? (' · ' + source) : '');
        } catch (e) {
            return source ? ('Source: ' + source) : 'Update time unavailable';
        }
    }

    function fmtIbGatewayStatus(info) {
        if (!info || info.status === 'demo') return { text: info?.status === 'demo' ? 'Sample data' : '', color: 'var(--text-muted)' };
        var status = info.status || 'unknown';
        var ts = info.timestamp;
        var time = '';
        if (ts) {
            try {
                time = new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            } catch (e) {}
        }
        if (status === 'live') return { text: 'IB Gateway: LIVE' + (time ? ' · ' + time : ''), color: 'var(--positive)' };
        if (status === 'stale') return { text: 'IB Gateway: STALE' + (time ? ' · ' + time : ''), color: 'var(--warning)' };
        if (status === 'offline') return { text: 'IB Gateway: OFFLINE', color: 'var(--negative)' };
        return { text: 'IB Gateway: ERROR', color: 'var(--negative)' };
    }

    var latestPortfolioData = null;

    function isCryptoPosition(p) {
        if (!p) return false;
        var symbol = String(p.symbol || '').toUpperCase();
        var assetClass = String(p.assetClass || p.listingExchange || '').toUpperCase();
        return symbol === 'BTC' || symbol === 'ETH' || assetClass === 'CRYPTO';
    }

    function fmtQty(val, p) {
        if (val === null || val === undefined || val === '' || isNaN(Number(val))) return '--';
        var num = Number(val);
        if (isCryptoPosition(p)) {
            return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 });
        }
        return Math.round(num).toLocaleString('en-US');
    }

    function fmtMoney(val, currency, p) {
        if (val === null || val === undefined || val === '' || isNaN(Number(val))) return '--';
        var num = Number(val);
        var cs = currencySymbol(currency || 'EUR');
        if (isCryptoPosition(p)) {
            return fmtPrice(num, cs);
        }
        if (Math.abs(num) < 1000) {
            return cs + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        return cs + Math.round(num).toLocaleString('en-US');
    }

    function fmtPnl(val, currency, p) {
        if (val === null || val === undefined || val === '' || isNaN(Number(val))) return '--';
        var num = Number(val);
        var sign = num > 0 ? '+' : num < 0 ? '-' : '';
        var abs = Math.abs(num);
        return sign + fmtMoney(abs, currency, p);
    }

    function getPositionFiatValue(p) {
        if (p.positionValue !== null && p.positionValue !== undefined && !isNaN(Number(p.positionValue))) {
            return Number(p.positionValue);
        }
        if (p.value !== null && p.value !== undefined && !isNaN(Number(p.value))) {
            return Number(p.value);
        }
        var qty = Number(p.quantity);
        var price = Number(p.livePrice ?? p.finnhubPrice ?? p.markPrice ?? p.price);
        if (!isNaN(qty) && !isNaN(price)) return qty * price;
        return null;
    }

    function getPositionDailyPnl(p) {
        var candidates = [
            p.dayPnl,
            p.dailyPnl,
            p.pnlDay,
            p.dailyChangeValue
        ];
        for (var i = 0; i < candidates.length; i++) {
            var candidate = candidates[i];
            if (candidate !== null && candidate !== undefined && !isNaN(Number(candidate))) {
                return Number(candidate);
            }
        }
        var qty = Number(p.quantity);
        var current = Number(p.livePrice ?? p.finnhubPrice ?? p.markPrice ?? p.price);
        var close = Number(p.dailyReferencePrice || p.close || p.previousClose || p.prevClose);
        if (!isNaN(qty) && !isNaN(current) && !isNaN(close)) {
            return (current - close) * qty;
        }
        return null;
    }

    function getPositionDailyPnlInEur(data, p) {
        if (p.dayPnlEUR !== null && p.dayPnlEUR !== undefined && !isNaN(Number(p.dayPnlEUR))) {
            return Number(p.dayPnlEUR);
        }
        var daily = getPositionDailyPnl(p);
        if (daily === null || daily === undefined || isNaN(Number(daily))) return null;
        var base=String(data?.summary?.baseCurrency||'EUR').toUpperCase();
        var currency = String((p && p.currency) || base).toUpperCase();
        if(base!=='EUR')return currency===base?Number(daily):null;
        if (currency === 'USD'){const rate=getPortfolioFxRateToEur(data);return rate===null?null:Number(daily)*rate;}
        return Number(daily);
    }

    function getPositionDailyPercent(p) {
        var candidates = [
            p.dayChangePercent,
            p.dayChangePct,
            p.dayPercent,
            p.dailyPercent,
            p.changePct,
            p.changePercent,
            p.finnhubChangePercent
        ];
        for (var i = 0; i < candidates.length; i++) {
            var candidate = candidates[i];
            if (candidate !== null && candidate !== undefined && !isNaN(Number(candidate))) {
                return Number(candidate);
            }
        }
        var current = Number(p.livePrice ?? p.finnhubPrice ?? p.markPrice ?? p.price);
        var close = Number(p.dailyReferencePrice || p.close || p.previousClose || p.prevClose);
        if (!isNaN(current) && !isNaN(close) && close > 0) {
            return ((current - close) / close) * 100;
        }
        return null;
    }

    function getPortfolioFxRateToEur(data) {
        var summary = data && data.summary ? data.summary : {};
        var usd = Number(summary.totalUSD || summary.totalValueUSD || summary.usdSubtotal);
        var eur = Number(summary.totalEUR || summary.totalValueEUR || summary.eurSubtotal);
        var totalEur = Number(summary.totalPortfolioValueEUR || summary.netLiquidationEUR || summary.netLiquidation || summary.totalValueEURConverted);
        if (!isNaN(usd) && usd > 0 && !isNaN(totalEur) && !isNaN(eur)) {
            var implied = (totalEur - eur) / usd;
            if (!isNaN(implied) && implied > 0) return implied;
        }
        if (!isNaN(summary.usdToEurRate) && Number(summary.usdToEurRate) > 0) {
            return Number(summary.usdToEurRate);
        }
        if (!isNaN(summary.eurUsdRate) && Number(summary.eurUsdRate) > 0) {
            return 1 / Number(summary.eurUsdRate);
        }
        return null;
    }

    function getPositionValueInEur(data, p) {
        var value = getPositionFiatValue(p);
        if (value === null || value === undefined || isNaN(Number(value))) return null;
        var base=String(data?.summary?.baseCurrency||'EUR').toUpperCase();
        var currency = String((p && p.currency) || base).toUpperCase();
        if(base!=='EUR')return currency===base?Number(value):null;
        if (currency === 'EUR' || !currency) return Number(value);
        if (currency === 'USD'){const rate=getPortfolioFxRateToEur(data);return rate===null?null:Number(value)*rate;}
        return null;
    }

    function getPortfolioTotal(data, positions) {
        var summary = data && data.summary ? data.summary : {};
        var candidates = summary.baseCurrency&&summary.baseCurrency!=='EUR'?[summary.netLiquidation,summary.totalValue]:[summary.totalPortfolioValueEUR, summary.netLiquidationEUR, summary.totalValueEURConverted,summary.netLiquidation];
        for (var i = 0; i < candidates.length; i++) {
            var candidate = candidates[i];
            if (candidate !== null && candidate !== undefined && !isNaN(Number(candidate))) {
                return Number(candidate);
            }
        }
        const values=positions.map(p=>getPositionValueInEur(data,p));return values.some(value=>value===null)?null:values.reduce((sum,value)=>sum+value,0);
    }

    function getPositionsByAssetClass(positions) {
        var all = Array.isArray(positions) ? positions : [];
        return {
            stocks: all.filter(function(p) { return !isCryptoPosition(p); }),
            crypto: all.filter(function(p) { return isCryptoPosition(p); })
        };
    }

    function sumPortfolioMetric(positions, getter) {
        var total = 0;
        var found = false;
        (positions || []).forEach(function(p) {
            var value = getter(p);
            if (value !== null && value !== undefined && !isNaN(Number(value))) {
                total += Number(value);
                found = true;
            }
        });
        return found ? total : null;
    }

    function getPositionTotalPnl(p) {
        var candidates = [
            p.totalPnl,
            p.totalPnL,
            p.unrealizedPL,
            p.unrealizedPnl,
            p.unrealizedPnL,
            p.pnl,
            p.pAndL
        ];
        for (var i = 0; i < candidates.length; i++) {
            var candidate = candidates[i];
            if (candidate !== null && candidate !== undefined && !isNaN(Number(candidate))) {
                var numeric = Number(candidate);
                if (numeric !== 0) {
                    return numeric;
                }
            }
        }
        var qty = Number(p.quantity);
        var current = Number(p.livePrice ?? p.finnhubPrice ?? p.markPrice ?? p.price);
        var costBasis = Number(p.costBasisPrice || p.avgCost || p.averageCost || p.costPrice);
        if (!isNaN(qty) && !isNaN(current) && !isNaN(costBasis) && costBasis > 0) {
            return (current - costBasis) * qty;
        }
        for (var j = 0; j < candidates.length; j++) {
            var fallback = candidates[j];
            if (fallback !== null && fallback !== undefined && !isNaN(Number(fallback))) {
                return Number(fallback);
            }
        }
        return null;
    }

    function getPortfolioDailyPnl(data, positions) {
        var summary = data && data.summary ? data.summary : {};
        var candidates = [summary.dayPnlEUR, summary.dailyPnlEUR, summary.dayPnl, summary.dailyPnl, summary.pnlDay, summary.dailyChangeValue];
        for (var i = 0; i < candidates.length; i++) {
            var candidate = candidates[i];
            if (candidate !== null && candidate !== undefined && !isNaN(Number(candidate))) {
                return Number(candidate);
            }
        }
        return positions.reduce(function(sum, p) {
            var value = getPositionDailyPnlInEur(data, p);
            return sum + (value || 0);
        }, 0);
    }

    function getPortfolioTotalPnl(data, positions) {
        var summary = data && data.summary ? data.summary : {};
        var candidates = [summary.totalPnl, summary.totalPnL, summary.unrealizedPL, summary.unrealizedPnl, summary.unrealizedPnL, summary.openPnl];
        for (var i = 0; i < candidates.length; i++) {
            var candidate = candidates[i];
            if (candidate !== null && candidate !== undefined && !isNaN(Number(candidate))) {
                return Number(candidate);
            }
        }
        var total = 0;
        var found = false;
        positions.forEach(function(p) {
            var value = getPositionTotalPnl(p);
            if (value !== null && value !== undefined && !isNaN(Number(value))) {
                total += Number(value);
                found = true;
            }
        });
        return found ? total : null;
    }

    function renderPortfolio() {
        var headEl = document.getElementById('portfolio-head');
        var bodyEl = document.getElementById('portfolio-body');
        var totalEl = document.getElementById('portfolio-total');
        var totalValueEl = document.getElementById('portfolio-total-value');
        var totalPnlEl = document.getElementById('portfolio-total-pnl');
        var totalTotalPnlEl = document.getElementById('portfolio-total-total-pnl');
        var positions = (latestPortfolioData && latestPortfolioData.positions) || [];
        var summary = (latestPortfolioData && latestPortfolioData.summary) || {};
        var baseCurrency = summary.baseCurrency || 'EUR';

        if (!positions.length) {
            headEl.innerHTML = '';
            bodyEl.innerHTML = '<tr><td colspan="4" style="color:var(--text-muted);font-size: 14px;">No holdings</td></tr>';
            totalEl.style.display = 'none';
            return;
        }

        headEl.innerHTML = '<tr><th>Ticker</th><th>Price</th><th>Value</th><th>24h</th></tr>';
        bodyEl.innerHTML = positions.slice(0,config.maxRows||positions.length).map(function(p) {
            var cs = currencySymbol(p.currency);
            var price = p.livePrice ?? p.finnhubPrice ?? p.markPrice ?? p.price;
            var change = getPositionDailyPercent(p);
            var hasChange = change !== null && change !== undefined && !isNaN(Number(change));
            var changeNum = hasChange ? Number(change) : null;
            var changeStr = hasChange ? (changeNum > 0 ? '+' : '') + changeNum.toFixed(2) + '%' : '\u2014';
            var changeColor = changeNum > 0 ? 'var(--positive)' : changeNum < 0 ? 'var(--negative)' : 'var(--text-muted)';

            return '<tr>' +
                '<td style="color:var(--accent);font-weight:600;">' + escapeHtml(p.symbol) + '</td>' +
                '<td>' + fmtPrice(price, cs) + '</td>' +
                '<td>' + fmtMoney(getPositionValueInEur(latestPortfolioData, p), baseCurrency, p) + '</td>' +
                '<td style="color:' + changeColor + '">' + changeStr + '</td>' +
            '</tr>';
        }).join('');
        var positionsTotal = getPortfolioTotal(latestPortfolioData, positions);
        var positionsDailyPnl = getPortfolioDailyPnl(latestPortfolioData, positions);
        var positionsTotalPnl = getPortfolioTotalPnl(latestPortfolioData, positions);
        totalValueEl.textContent = fmtMoney(positionsTotal, baseCurrency);
        totalPnlEl.textContent = fmtPnl(positionsDailyPnl, baseCurrency);
        totalPnlEl.style.color = positionsDailyPnl > 0 ? 'var(--positive)' : positionsDailyPnl < 0 ? 'var(--negative)' : 'var(--accent)';
        totalTotalPnlEl.textContent = positionsTotalPnl === null ? '--' : fmtPnl(positionsTotalPnl, baseCurrency);
        totalTotalPnlEl.style.color = positionsTotalPnl > 0 ? 'var(--positive)' : positionsTotalPnl < 0 ? 'var(--negative)' : 'var(--accent)';
        totalEl.style.display = 'flex';
    }

    async function loadPortfolio() {
        try {
            var data = await fetchJSON('/api/dashboard/portfolio');
            latestPortfolioData = data || { positions: [], summary: {} };
            var positions = latestPortfolioData.positions || [];
            var ibStatusEl = document.getElementById('portfolio-ib-status');
            if (ibStatusEl) {
                var ib = fmtIbGatewayStatus(data.ibGateway);
                ibStatusEl.textContent = data.demo ? 'Demo portfolio' : ib.text;
                ibStatusEl.style.color = ib.color;
            }

            if (!positions.length) {
                latestPortfolioData = { positions: [], summary: data.summary || {} };
            }
            renderPortfolio();
        } catch (e) {
            latestPortfolioData = null;
            var ibStatusEl = document.getElementById('portfolio-ib-status');
            if (ibStatusEl) {
                ibStatusEl.textContent = 'Source unavailable · retrying';
                ibStatusEl.style.color = 'var(--negative)';
            }
            document.getElementById('portfolio-head').innerHTML = '';
            document.getElementById('portfolio-total').style.display = 'none';
            document.getElementById('portfolio-body').innerHTML = '<tr><td colspan="4" style="color:var(--negative);font-size: 14px;">Error loading portfolio</td></tr>';
        }
    }

    loadPortfolio();
    setInterval(loadPortfolio, config.refreshSeconds ? config.refreshSeconds*1000 : REFRESH.PORTFOLIO);

}
