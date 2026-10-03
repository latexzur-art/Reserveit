
import AcademicHeadLayout from "@/components/layout/AcademicHeadLayout"
import { AssistantMount } from "@/components/ai/AssistantMount"

export default function Layout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <AcademicHeadLayout>
            {children}
            <AssistantMount />
        </AcademicHeadLayout>
    )
}
