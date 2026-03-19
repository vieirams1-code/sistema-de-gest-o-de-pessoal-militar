import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { createPageUrl } from '@/utils'

export default function CadastrarPublicacao() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const params = new URLSearchParams()
    const id = searchParams.get('id')
    const tipo = searchParams.get('tipo')
    const militar_id = searchParams.get('militar_id')
    const ref_id = searchParams.get('ref_id')
    const origem_tipo = searchParams.get('origem_tipo')

    if (id) params.set('id', id)
    if (tipo) params.set('tipo', tipo)
    if (militar_id) params.set('militar_id', militar_id)
    if (ref_id) params.set('ref_id', ref_id)
    if (origem_tipo) params.set('origem_tipo', origem_tipo)

    const qs = params.toString()
    const dest = createPageUrl('CadastrarRegistroRP') + (qs ? '?' + qs : '')

    navigate(dest, { replace: true })
  }, [])

  return null
}
