// 관리자 계정은 환경변수에서만 읽음 - 절대 코드에 하드코딩 X
let users = [] // 회원가입한 일반 유저들

export function getAdmin() {
  return {
    id: 0,
    name: process.env.ADMIN_ID,
    email: process.env.ADMIN_ID,
    role: 'admin'
  }
}

export function findUser(id, password) {
  // 관리자 체크
  if (id === process.env.ADMIN_ID && password === process.env.ADMIN_PW) {
    return getAdmin()
  }
  // 일반 유저 체크
  return users.find(u => u.email === id && u.password === password) || null
}

export function findByEmail(email) {
  if (email === process.env.ADMIN_ID) return { exists: true }
  return users.find(u => u.email === email) || null
}

export function createUser(name, email, password) {
  const user = { id: Date.now(), name, email, password, role: 'user' }
  users.push(user)
  return { id: user.id, name: user.name, email: user.email, role: user.role }
}
