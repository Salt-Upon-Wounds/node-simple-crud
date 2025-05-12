import request from 'supertest'
import server from '../server'
import * as uuid from 'uuid'

jest.mock('uuid', () => ({
  ...jest.requireActual('uuid'),
  validate: jest.fn(),
  v4: jest.fn(),
}))
const mockedUuid = uuid.v4 as jest.Mock
const mockedValidate = uuid.validate as jest.Mock

describe('Server Tests', () => {
  it('should return status 200', async () => {
    const response = await request(server()).get('/api/users')
    expect(response.status).toBe(200)
  })
  it('should return status 404', async () => {
    const response = await request(server()).get('/api/usersssss')
    expect(response.status).toBe(404)
  })
  it('should return new added user', async () => {
    const newUser = {
      username: 'asd',
      age: 1,
      hobbies: [],
    }
    const mockId = '11111111-1111-1111-1111-111111111111'
    mockedUuid.mockReturnValue(mockId)
    mockedValidate.mockReturnValue(true)

    const postRes = await request(server()).post('/api/users').send(newUser).expect(201)
    expect(postRes.body).toEqual({ id: mockId, ...newUser })

    const getRes = await request(server()).get(`/api/users/${mockId}`).expect(200)
    expect(getRes.body).toEqual({ id: mockId, ...newUser })
  })
})
