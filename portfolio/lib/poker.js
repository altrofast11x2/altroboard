export const SUITS = ['S','H','D','C']
export const RANKS = ['2','3','4','5','6','7','8','9','T','J','Q','K','A']

export function makeDeck() {
  const deck = []
  for (const suit of SUITS)
    for (const rank of RANKS)
      deck.push({ suit, rank, value: RANKS.indexOf(rank) })
  return shuffle(deck)
}

export function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function getCombinations(arr, k) {
  if (k === arr.length) return [arr]
  if (k === 1) return arr.map(x => [x])
  const result = []
  for (let i = 0; i <= arr.length - k; i++) {
    const rest = getCombinations(arr.slice(i + 1), k - 1)
    for (const r of rest) result.push([arr[i], ...r])
  }
  return result
}

function compareKickers(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] || 0) - (b[i] || 0)
    if (diff !== 0) return diff
  }
  return 0
}

function score5(cards) {
  const vals = cards.map(c => c.value).sort((a, b) => b - a)
  const suits = cards.map(c => c.suit)
  const counts = {}
  for (const v of vals) counts[v] = (counts[v] || 0) + 1
  const groups = Object.entries(counts).sort((a, b) => b[1] - a[1] || b[0] - a[0])
  const freqs = groups.map(g => g[1])
  const groupVals = groups.map(g => parseInt(g[0]))
  const isFlush = suits.every(s => s === suits[0])
  const isWheel = JSON.stringify(vals) === JSON.stringify([12, 3, 2, 1, 0])
  const isStraight = (() => {
    if (isWheel) return true
    for (let i = 0; i < vals.length - 1; i++)
      if (vals[i] - vals[i + 1] !== 1) return false
    return true
  })()
  const straightHigh = isWheel ? 3 : vals[0]
  if (isFlush && isStraight) {
    if (vals[0] === 12 && !isWheel) return { rank: 9, name: 'Royal Flush', tiebreak: [straightHigh] }
    return { rank: 8, name: 'Straight Flush', tiebreak: [straightHigh] }
  }
  if (freqs[0] === 4) return { rank: 7, name: 'Four of a Kind', tiebreak: [groupVals[0], groupVals[1]] }
  if (freqs[0] === 3 && freqs[1] === 2) return { rank: 6, name: 'Full House', tiebreak: [groupVals[0], groupVals[1]] }
  if (isFlush) return { rank: 5, name: 'Flush', tiebreak: vals }
  if (isStraight) return { rank: 4, name: 'Straight', tiebreak: [straightHigh] }
  if (freqs[0] === 3) return { rank: 3, name: 'Three of a Kind', tiebreak: [groupVals[0], ...groupVals.slice(1)] }
  if (freqs[0] === 2 && freqs[1] === 2) return { rank: 2, name: 'Two Pair', tiebreak: [groupVals[0], groupVals[1], groupVals[2]] }
  if (freqs[0] === 2) return { rank: 1, name: 'One Pair', tiebreak: [groupVals[0], ...groupVals.slice(1)] }
  return { rank: 0, name: 'High Card', tiebreak: vals }
}

export function evaluateHand(cards) {
  const combos = getCombinations(cards, 5)
  let best = null
  for (const combo of combos) {
    const s = score5(combo)
    if (!best || s.rank > best.rank || (s.rank === best.rank && compareKickers(s.tiebreak, best.tiebreak) > 0))
      best = { ...s, cards: combo }
  }
  return best
}

export function findWinners(players, community) {
  const results = players.map(p => ({ ...p, best: evaluateHand([...p.holeCards, ...community]) }))
  let topRank = -1
  for (const r of results) if (r.best.rank > topRank) topRank = r.best.rank
  let winners = results.filter(r => r.best.rank === topRank)
  const len = Math.max(...winners.map(r => r.best.tiebreak.length))
  for (let i = 0; i < len && winners.length > 1; i++) {
    const maxVal = Math.max(...winners.map(r => r.best.tiebreak[i] || 0))
    winners = winners.filter(r => (r.best.tiebreak[i] || 0) === maxVal)
  }
  return { winners: winners.map(r => r.id), results }
}

export function suitSymbol(s) { return { S: '♠', H: '♥', D: '♦', C: '♣' }[s] || s }
export function rankDisplay(r) { return r === 'T' ? '10' : r }
export function isRed(suit) { return suit === 'H' || suit === 'D' }

export function dealNewHand(seats, smallBlind, bigBlind, dealerIdx, handNum) {
  const active = seats.filter(s => s && s.chips > 0)
  if (active.length < 2) return null
  const deck = makeDeck()
  const players = active.map(s => ({
    uid: s.uid, name: s.name, chips: s.chips,
    holeCards: [deck.pop(), deck.pop()],
    bet: 0, totalBet: 0, folded: false, allIn: false,
  }))
  const n = players.length
  const dIdx = dealerIdx % n
  const sbIdx = (dIdx + 1) % n
  const bbIdx = (dIdx + 2) % n
  const sb = Math.min(smallBlind, players[sbIdx].chips)
  const bb = Math.min(bigBlind, players[bbIdx].chips)
  players[sbIdx].chips -= sb; players[sbIdx].bet = sb; players[sbIdx].totalBet = sb
  if (!players[sbIdx].chips) players[sbIdx].allIn = true
  players[bbIdx].chips -= bb; players[bbIdx].bet = bb; players[bbIdx].totalBet = bb
  if (!players[bbIdx].chips) players[bbIdx].allIn = true
  return {
    players,
    deck: deck.map(c => c.rank + c.suit),
    community: [],
    pot: sb + bb,
    stage: 'preflop',
    currentBet: bb,
    dealerIdx: dIdx, sbIdx, bbIdx,
    currentPlayerIdx: (bbIdx + 1) % n,
    lastRaiserIdx: bbIdx,
    smallBlind, bigBlind, handNum,
    log: [`핸드 #${handNum}`, `${players[sbIdx].name} SB ${sb}`, `${players[bbIdx].name} BB ${bb}`],
    winner: null, showCards: false, status: 'playing',
  }
}

function nextActive(players, from) {
  const n = players.length
  let idx = (from + 1) % n
  for (let i = 0; i < n; i++) {
    if (!players[idx].folded && !players[idx].allIn && players[idx].chips > 0) return idx
    idx = (idx + 1) % n
  }
  return idx
}

export function applyAction(gs, action, amount) {
  const s = JSON.parse(JSON.stringify(gs))
  const p = s.players[s.currentPlayerIdx]

  if (action === 'fold') { p.folded = true; s.log = [`${p.name} 폴드`, ...s.log].slice(0, 10) }
  else if (action === 'check') { s.log = [`${p.name} 체크`, ...s.log].slice(0, 10) }
  else if (action === 'call') {
    const c = Math.min(s.currentBet - p.bet, p.chips)
    p.chips -= c; s.pot += c; p.bet += c; p.totalBet += c
    if (!p.chips) p.allIn = true
    s.log = [`${p.name} 콜 ${c}`, ...s.log].slice(0, 10)
  } else if (action === 'raise') {
    const extra = Math.min(amount - p.bet, p.chips)
    const nb = p.bet + extra
    s.currentBet = nb; p.chips -= extra; s.pot += extra; p.bet = nb; p.totalBet += extra
    s.lastRaiserIdx = s.currentPlayerIdx
    if (!p.chips) p.allIn = true
    s.log = [`${p.name} 레이즈 ${nb}`, ...s.log].slice(0, 10)
  } else if (action === 'allin') {
    const all = p.chips
    if (p.bet + all > s.currentBet) { s.currentBet = p.bet + all; s.lastRaiserIdx = s.currentPlayerIdx }
    s.pot += all; p.bet += all; p.totalBet += all; p.chips = 0; p.allIn = true
    s.log = [`${p.name} 올인 ${all}`, ...s.log].slice(0, 10)
  }

  const standing = s.players.filter(p => !p.folded)
  if (standing.length === 1) {
    standing[0].chips += s.pot
    s.log = [`${standing[0].name} 팟 ${s.pot}`, ...s.log].slice(0, 10)
    s.pot = 0; s.winner = [standing[0].uid]; s.stage = 'showdown'; s.status = 'done'
    return s
  }

  const canAct = s.players.filter(p => !p.folded && !p.allIn)
  const allMatched = canAct.every(p => p.bet === s.currentBet) || canAct.length <= 1
  const next = nextActive(s.players, s.currentPlayerIdx)
  if (allMatched && (canAct.length <= 1 || next === s.lastRaiserIdx || (action !== 'raise' && action !== 'allin' && allMatched)))
    return advanceStage(s)
  s.currentPlayerIdx = next
  return s
}

function parseDeck(deck) {
  return deck.map(str => ({ rank: str.slice(0, -1), suit: str.slice(-1), value: RANKS.indexOf(str.slice(0, -1)) }))
}

function advanceStage(s) {
  for (const p of s.players) p.bet = 0
  s.currentBet = 0
  const stages = ['preflop','flop','turn','river','showdown']
  const next = stages[stages.indexOf(s.stage) + 1]
  const deck = parseDeck(s.deck)
  if (next === 'flop') {
    const c = [deck.pop(), deck.pop(), deck.pop()]
    s.community = c; s.deck = deck.map(c => c.rank + c.suit)
    s.log = [`플롭: ${c.map(c => rankDisplay(c.rank) + suitSymbol(c.suit)).join(' ')}`, ...s.log].slice(0, 10)
  } else if (next === 'turn') {
    const c = deck.pop(); s.community = [...s.community, c]; s.deck = deck.map(c => c.rank + c.suit)
    s.log = [`턴: ${rankDisplay(c.rank) + suitSymbol(c.suit)}`, ...s.log].slice(0, 10)
  } else if (next === 'river') {
    const c = deck.pop(); s.community = [...s.community, c]; s.deck = deck.map(c => c.rank + c.suit)
    s.log = [`리버: ${rankDisplay(c.rank) + suitSymbol(c.suit)}`, ...s.log].slice(0, 10)
  } else if (next === 'showdown') { return doShowdown(s) }
  s.stage = next; s.lastRaiserIdx = -1
  const n = s.players.length
  let fi = (s.dealerIdx + 1) % n
  for (let i = 0; i < n; i++) { if (!s.players[fi].folded && !s.players[fi].allIn) break; fi = (fi + 1) % n }
  s.currentPlayerIdx = fi
  if (s.players.filter(p => !p.folded && !p.allIn).length <= 1) return advanceStage(s)
  return s
}

function doShowdown(s) {
  s.stage = 'showdown'; s.showCards = true; s.status = 'done'
  const notFolded = s.players.filter(p => !p.folded)
  const { winners, results } = findWinners(notFolded.map(p => ({ id: p.uid, holeCards: p.holeCards })), s.community)
  for (const p of s.players) { const r = results.find(r => r.id === p.uid); if (r) p.handName = r.best.name }
  const share = Math.floor(s.pot / winners.length)
  for (const wuid of winners) { const wp = s.players.find(p => p.uid === wuid); if (wp) wp.chips += share }
  s.winner = winners
  const winNames = winners.map(uid => s.players.find(p => p.uid === uid)?.name).join(', ')
  const handName = results.find(r => r.id === winners[0])?.best.name
  s.log = [`${winNames} 승리 (${handName}) +${share}`, ...s.log].slice(0, 10)
  return s
}
