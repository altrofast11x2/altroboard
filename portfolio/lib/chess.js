// ── 체스 엔진 ──────────────────────────────────────────
export const PIECES = { K:'King', Q:'Queen', R:'Rook', B:'Bishop', N:'Knight', P:'Pawn' }
export const WHITE = 'w', BLACK = 'b'

// Firebase는 배열을 객체로 저장하므로 복원 필요
export function normalizeGs(gs) {
  if (!gs) return gs
  const board = Array.from({length:8}, (_,r) =>
    Array.from({length:8}, (_,c) => {
      const row = gs.board?.[r]
      return Array.isArray(row) ? row[c] : (row?.[c] ?? null)
    })
  )
  const capturedW = gs.capturedW
    ? (Array.isArray(gs.capturedW) ? gs.capturedW : Object.values(gs.capturedW))
    : []
  const capturedB = gs.capturedB
    ? (Array.isArray(gs.capturedB) ? gs.capturedB : Object.values(gs.capturedB))
    : []
  const enPassant = gs.enPassant
    ? (Array.isArray(gs.enPassant) ? gs.enPassant : Object.values(gs.enPassant))
    : null
  return { ...gs, board, capturedW, capturedB, enPassant }
}

export function initBoard() {
  const b = Array(8).fill(null).map(() => Array(8).fill(null))
  const order = ['R','N','B','Q','K','B','N','R']
  for (let c = 0; c < 8; c++) {
    b[0][c] = { type: order[c], color: BLACK }
    b[1][c] = { type: 'P', color: BLACK }
    b[6][c] = { type: 'P', color: WHITE }
    b[7][c] = { type: order[c], color: WHITE }
  }
  return b
}

export function initGameState() {
  return {
    board: initBoard(),
    turn: WHITE,
    castling: { wK: true, wQR: true, wKR: true, bK: true, bQR: true, bKR: true },
    enPassant: null,       // [row, col] 앙파상 가능 위치
    halfMove: 0,
    fullMove: 1,
    status: 'playing',     // playing | check | checkmate | stalemate | draw
    winner: null,
    lastMove: null,
    capturedW: [],         // 백이 잡은 흑 기물
    capturedB: [],         // 흑이 잡은 백 기물
    promotePending: null,  // { row, col } 프로모션 대기
  }
}

// ── 이동 가능 위치 계산 ──────────────────────────────────
export function getLegalMoves(gs, row, col) {
  const piece = gs.board[row][col]
  if (!piece || piece.color !== gs.turn) return []
  const pseudo = getPseudoMoves(gs, row, col)
  return pseudo.filter(([tr, tc]) => {
    const next = applyMoveRaw(gs, row, col, tr, tc, null)
    return !isInCheck(next.board, gs.turn)
  })
}

function getPseudoMoves(gs, row, col) {
  const { board, enPassant, castling } = gs
  const piece = board[row][col]
  const { type, color } = piece
  const moves = []
  const dir = color === WHITE ? -1 : 1
  const opp = color === WHITE ? BLACK : WHITE

  function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8 }
  function addSlide(dr, dc) {
    let r = row + dr, c = col + dc
    while (inBounds(r, c)) {
      if (!board[r][c]) { moves.push([r, c]); r += dr; c += dc }
      else { if (board[r][c].color === opp) moves.push([r, c]); break }
    }
  }

  if (type === 'P') {
    // 전진
    if (inBounds(row + dir, col) && !board[row + dir][col]) {
      moves.push([row + dir, col])
      // 2칸 전진
      const startRow = color === WHITE ? 6 : 1
      if (row === startRow && !board[row + 2 * dir][col]) moves.push([row + 2 * dir, col])
    }
    // 대각 포획
    for (const dc of [-1, 1]) {
      const r = row + dir, c = col + dc
      if (inBounds(r, c)) {
        if (board[r][c]?.color === opp) moves.push([r, c])
        // 앙파상
        if (enPassant && enPassant[0] === r && enPassant[1] === c) moves.push([r, c])
      }
    }
  }

  if (type === 'N') {
    for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
      const r = row+dr, c = col+dc
      if (inBounds(r,c) && board[r][c]?.color !== color) moves.push([r,c])
    }
  }

  if (type === 'B' || type === 'Q') {
    for (const [dr,dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) addSlide(dr,dc)
  }
  if (type === 'R' || type === 'Q') {
    for (const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]) addSlide(dr,dc)
  }

  if (type === 'K') {
    for (const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
      const r=row+dr, c=col+dc
      if (inBounds(r,c) && board[r][c]?.color !== color) moves.push([r,c])
    }
    // 캐슬링
    const baseRow = color === WHITE ? 7 : 0
    if (row === baseRow && col === 4) {
      const kKey = color === WHITE ? 'wK' : 'bK'
      const krKey = color === WHITE ? 'wKR' : 'bKR'
      const qrKey = color === WHITE ? 'wQR' : 'bQR'
      if (castling[kKey]) {
        // 킹사이드
        if (castling[krKey] && !board[baseRow][5] && !board[baseRow][6] &&
            !isSquareAttacked(board, baseRow, 4, opp) &&
            !isSquareAttacked(board, baseRow, 5, opp) &&
            !isSquareAttacked(board, baseRow, 6, opp)) {
          moves.push([baseRow, 6])
        }
        // 퀸사이드
        if (castling[qrKey] && !board[baseRow][3] && !board[baseRow][2] && !board[baseRow][1] &&
            !isSquareAttacked(board, baseRow, 4, opp) &&
            !isSquareAttacked(board, baseRow, 3, opp) &&
            !isSquareAttacked(board, baseRow, 2, opp)) {
          moves.push([baseRow, 2])
        }
      }
    }
  }

  return moves
}

function isSquareAttacked(board, row, col, byColor) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c]
      if (p?.color !== byColor) continue
      const fakeGs = { board, turn: byColor, enPassant: null, castling: { wK:false,bK:false,wKR:false,wQR:false,bKR:false,bQR:false } }
      const moves = getPseudoMoves(fakeGs, r, c)
      if (moves.some(([mr,mc]) => mr===row && mc===col)) return true
    }
  }
  return false
}

export function isInCheck(board, color) {
  // 킹 위치 찾기
  let kr = -1, kc = -1
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c]?.type === 'K' && board[r][c]?.color === color) { kr=r; kc=c }
  return isSquareAttacked(board, kr, kc, color===WHITE?BLACK:WHITE)
}

// ── 실제 이동 적용 ──────────────────────────────────────
function applyMoveRaw(gs, fromR, fromC, toR, toC, promote) {
  const b = gs.board.map(r => r.map(c => c ? {...c} : null))
  const piece = b[fromR][fromC]
  const captured = b[toR][toC]
  const capW = [...(gs.capturedW||[])]
  const capB = [...(gs.capturedB||[])]

  if (captured) {
    if (piece.color === WHITE) capW.push(captured)
    else capB.push(captured)
  }

  b[toR][toC] = piece
  b[fromR][fromC] = null

  // 앙파상 포획
  if (piece.type === 'P' && gs.enPassant && toR===gs.enPassant[0] && toC===gs.enPassant[1]) {
    const capRow = fromR
    const capPiece = b[capRow][toC]
    if (capPiece) {
      if (piece.color === WHITE) capW.push(capPiece)
      else capB.push(capPiece)
    }
    b[capRow][toC] = null
  }

  // 캐슬링 룩 이동
  if (piece.type === 'K') {
    if (toC - fromC === 2) { // 킹사이드
      b[toR][5] = b[toR][7]; b[toR][7] = null
    } else if (fromC - toC === 2) { // 퀸사이드
      b[toR][3] = b[toR][0]; b[toR][0] = null
    }
  }

  // 프로모션
  if (piece.type === 'P' && (toR === 0 || toR === 7)) {
    b[toR][toC] = { type: promote || 'Q', color: piece.color }
  }

  // 새 앙파상
  let newEP = null
  if (piece.type === 'P' && Math.abs(toR - fromR) === 2) {
    newEP = [(fromR + toR) / 2, fromC]
  }

  // 캐슬링 권한 업데이트
  const cast = { ...gs.castling }
  if (piece.type === 'K') {
    if (piece.color === WHITE) { cast.wK=false; cast.wKR=false; cast.wQR=false }
    else { cast.bK=false; cast.bKR=false; cast.bQR=false }
  }
  if (piece.type === 'R') {
    if (fromR===7 && fromC===7) cast.wKR=false
    if (fromR===7 && fromC===0) cast.wQR=false
    if (fromR===0 && fromC===7) cast.bKR=false
    if (fromR===0 && fromC===0) cast.bQR=false
  }

  return {
    ...gs,
    board: b,
    castling: cast,
    enPassant: newEP,
    capturedW: capW,
    capturedB: capB,
  }
}

export function applyMove(gs, fromR, fromC, toR, toC, promote = null) {
  const next = applyMoveRaw(gs, fromR, fromC, toR, toC, promote)
  const piece = gs.board[fromR][fromC]

  // 프로모션 대기
  if (piece.type === 'P' && (toR === 0 || toR === 7) && !promote) {
    return {
      ...next,
      turn: gs.turn,
      promotePending: { row: toR, col: toC, fromR, fromC },
      lastMove: { fromR, fromC, toR, toC },
    }
  }

  const opp = gs.turn === WHITE ? BLACK : WHITE
  const nextBoard = next.board

  let status = 'playing'
  let winner = null

  // 체크 / 체크메이트 / 스테일메이트
  const oppInCheck = isInCheck(nextBoard, opp)
  const oppHasMoves = hasAnyLegalMove(next, opp)

  if (!oppHasMoves) {
    status = oppInCheck ? 'checkmate' : 'stalemate'
    winner = oppInCheck ? gs.turn : null
  } else if (oppInCheck) {
    status = 'check'
  }

  // 50수 규칙
  const hm = (piece.type === 'P' || next.capturedW.length > gs.capturedW.length || next.capturedB.length > gs.capturedB.length)
    ? 0 : gs.halfMove + 1
  if (hm >= 100) { status = 'draw'; winner = null }

  return {
    ...next,
    turn: opp,
    status,
    winner,
    halfMove: hm,
    fullMove: gs.turn === BLACK ? gs.fullMove + 1 : gs.fullMove,
    lastMove: { fromR, fromC, toR, toC },
    promotePending: null,
  }
}

function hasAnyLegalMove(gs, color) {
  const fakeGs = { ...gs, turn: color }
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (gs.board[r][c]?.color === color && getLegalMoves(fakeGs, r, c).length > 0)
        return true
  return false
}

// ── AI (Minimax + Alpha-Beta) ─────────────────────────
const PIECE_VALUE = { P:100, N:320, B:330, R:500, Q:900, K:20000 }

const PST = {
  P: [
    [0,0,0,0,0,0,0,0],[50,50,50,50,50,50,50,50],[10,10,20,30,30,20,10,10],
    [5,5,10,25,25,10,5,5],[0,0,0,20,20,0,0,0],[5,-5,-10,0,0,-10,-5,5],
    [5,10,10,-20,-20,10,10,5],[0,0,0,0,0,0,0,0]
  ],
  N: [[-50,-40,-30,-30,-30,-30,-40,-50],[-40,-20,0,0,0,0,-20,-40],[-30,0,10,15,15,10,0,-30],
      [-30,5,15,20,20,15,5,-30],[-30,0,15,20,20,15,0,-30],[-30,5,10,15,15,10,5,-30],
      [-40,-20,0,5,5,0,-20,-40],[-50,-40,-30,-30,-30,-30,-40,-50]],
  B: [[-20,-10,-10,-10,-10,-10,-10,-20],[-10,0,0,0,0,0,0,-10],[-10,0,5,10,10,5,0,-10],
      [-10,5,5,10,10,5,5,-10],[-10,0,10,10,10,10,0,-10],[-10,10,10,10,10,10,10,-10],
      [-10,5,0,0,0,0,5,-10],[-20,-10,-10,-10,-10,-10,-10,-20]],
  R: [[0,0,0,0,0,0,0,0],[5,10,10,10,10,10,10,5],[-5,0,0,0,0,0,0,-5],
      [-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],
      [-5,0,0,0,0,0,0,-5],[0,0,0,5,5,0,0,0]],
  Q: [[-20,-10,-10,-5,-5,-10,-10,-20],[-10,0,0,0,0,0,0,-10],[-10,0,5,5,5,5,0,-10],
      [-5,0,5,5,5,5,0,-5],[0,0,5,5,5,5,0,-5],[-10,5,5,5,5,5,0,-10],
      [-10,0,5,0,0,0,0,-10],[-20,-10,-10,-5,-5,-10,-10,-20]],
  K: [[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],
      [-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],
      [-20,-30,-30,-40,-40,-30,-30,-20],[-10,-20,-20,-20,-20,-20,-20,-10],
      [20,20,0,0,0,0,20,20],[20,30,10,0,0,10,30,20]],
}

function evaluate(board) {
  let score = 0
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c]
      if (!p) continue
      const val = PIECE_VALUE[p.type]
      const pstRow = p.color === WHITE ? r : 7 - r
      const pst = PST[p.type]?.[pstRow]?.[c] || 0
      score += p.color === WHITE ? (val + pst) : -(val + pst)
    }
  }
  return score
}

function getAllMoves(gs) {
  const moves = []
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (gs.board[r][c]?.color === gs.turn)
        for (const [tr,tc] of getLegalMoves(gs, r, c))
          moves.push([r, c, tr, tc])
  return moves
}

function minimax(gs, depth, alpha, beta, maximizing) {
  if (depth === 0 || gs.status === 'checkmate' || gs.status === 'stalemate' || gs.status === 'draw')
    return evaluate(gs.board)
  const moves = getAllMoves(gs)
  if (maximizing) {
    let best = -Infinity
    for (const [fr,fc,tr,tc] of moves) {
      const next = applyMove(gs, fr, fc, tr, tc, 'Q')
      best = Math.max(best, minimax(next, depth-1, alpha, beta, false))
      alpha = Math.max(alpha, best)
      if (beta <= alpha) break
    }
    return best
  } else {
    let best = Infinity
    for (const [fr,fc,tr,tc] of moves) {
      const next = applyMove(gs, fr, fc, tr, tc, 'Q')
      best = Math.min(best, minimax(next, depth-1, alpha, beta, true))
      beta = Math.min(beta, best)
      if (beta <= alpha) break
    }
    return best
  }
}

export function getBestMove(gs, depth = 3) {
  const moves = getAllMoves(gs)
  if (moves.length === 0) return null
  let bestMove = null
  let bestVal = gs.turn === WHITE ? -Infinity : Infinity
  for (const [fr,fc,tr,tc] of moves) {
    const next = applyMove(gs, fr, fc, tr, tc, 'Q')
    const val = minimax(next, depth-1, -Infinity, Infinity, gs.turn !== WHITE)
    if (gs.turn === WHITE ? val > bestVal : val < bestVal) {
      bestVal = val; bestMove = [fr,fc,tr,tc]
    }
  }
  return bestMove
}

// ── ELO 계산 ──────────────────────────────────────────
export function calcElo(ratingA, ratingB, resultA) {
  const K = 32
  const expected = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))
  return Math.round(ratingA + K * (resultA - expected))
}
