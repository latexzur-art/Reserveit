import { redirect } from 'next/navigation'
import { ROUTES } from '@/lib/routes'

export default function CurriculumPage() {
    redirect(ROUTES.academic.curriculumCourseCatalog)
}
