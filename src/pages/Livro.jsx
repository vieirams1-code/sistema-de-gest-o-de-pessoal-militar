import { Navigate } from 'react-router-dom'
import { createPageUrl } from '@/utils'

export default function Livro() {
  return <Navigate to={createPageUrl('RP')} replace />
}
