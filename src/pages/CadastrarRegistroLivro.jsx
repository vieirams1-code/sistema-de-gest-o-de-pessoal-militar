import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { createPageUrl } from '@/utils'

export default function CadastrarRegistroLivro() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const id = searchParams.get('id')
    const dest = id
      ? createPageUrl('CadastrarRegistroRP') + '?id=' + id
      : createPageUrl('CadastrarRegistroRP')

    navigate(dest, { replace: true })
  }, [])

  return null
}
