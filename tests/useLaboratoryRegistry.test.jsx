// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { repositoryResult } from '../src/core/data/repositoryResult'
import { useLaboratoryRegistry } from '../src/features/laboratory/hooks/useLaboratoryRegistry'

const repository = { list: vi.fn(), create: vi.fn() }
vi.mock('../src/features/laboratory/hooks/useLaboratoryRepository', () => ({ useLaboratoryRepository: () => repository }))

describe('canonical laboratory registry controller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    repository.list.mockResolvedValue(repositoryResult([{ id: 'LAB-1' }]))
    repository.create.mockResolvedValue({ id: 'LAB-2' })
  })

  it('loads rows and exposes repository readiness', async () => {
    const { result } = renderHook(() => useLaboratoryRegistry())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.rows).toEqual([{ id: 'LAB-1' }])
    expect(result.current.readiness).toBe('ready')
  })

  it('creates through the repository and refreshes the registry', async () => {
    const { result } = renderHook(() => useLaboratoryRegistry())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.createSample({ draft: { type: 'bloodCulture' } }))
    expect(repository.create).toHaveBeenCalledWith({ draft: { type: 'bloodCulture' } })
    expect(repository.list).toHaveBeenCalledTimes(2)
  })

  it('keeps backend failures distinct from an empty registry', async () => {
    repository.list.mockRejectedValueOnce(new Error('network down'))
    const { result } = renderHook(() => useLaboratoryRegistry())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toEqual(expect.objectContaining({ message: 'network down' }))
    expect(result.current.readiness).toBe('ready')
  })
})
