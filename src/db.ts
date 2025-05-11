import { User } from './types'
import { v4 as uuidv4 } from 'uuid'

const ids = [uuidv4(), uuidv4(), uuidv4()]
export const db = new Map<string, User>([
  [ids[0], { id: ids[0], username: 'user1', age: 1, hobbies: ['asd', 'qwe'] }],
  [ids[1], { id: ids[1], username: 'user2', age: 2, hobbies: ['zxc'] }],
  [ids[2], { id: ids[2], username: 'user3', age: 3, hobbies: [] }],
])

export function isUser(smth: unknown): smth is User {
  const body = smth as Record<string, unknown>
  return (
    body &&
    typeof body.id === 'string' &&
    typeof body.username === 'string' &&
    typeof body.age === 'number' &&
    Array.isArray(body.hobbies) &&
    body.hobbies.every((h: unknown) => typeof h === 'string')
  )
}
