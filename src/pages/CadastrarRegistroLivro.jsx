import { Navigate, useSearchParams } from 'react-router-dom'
import { createPageUrl } from '@/utils'

export default function CadastrarRegistroLivro() {
  const [searchParams] = useSearchParams()
  
  const id = searchParams.get('id')
  const dest = id ? `${createPageUrl('CadastrarRegistroRP')}?id=${id}` : createPageUrl('CadastrarRegistroRP')
  
  return <Navigate to={dest} replace />
}
