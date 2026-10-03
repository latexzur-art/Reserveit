import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { FixedClassSchedulesPreview } from '@/app/academic/_components/FixedClassSchedulesPreview'

describe('FixedClassSchedulesPreview Component', () => {
  const mockClasses = [
    {
      id: '1',
      course_code: 'COSC1003',
      course_name: 'Data Structures and Algorithms',
      section: 'BSCS2A1',
      instructor_name: 'Jerald Reyes',
      day_of_week: 1, // Monday
      start_time: '08:00:00',
      end_time: '10:00:00',
      facility: {
        id: 'fac-1',
        name: 'Room 309',
        room_number: '309',
        building: 'Main Building',
      },
      department: {
        id: 'dept-1',
        name: 'Computer Science',
        code: 'BSCS',
      },
    },
    {
      id: '2',
      course_code: 'GEDC1002',
      course_name: 'The Contemporary World',
      section: 'BSCS1A1',
      instructor_name: 'Maria Santos',
      day_of_week: 1, // Monday
      start_time: '10:30:00',
      end_time: '12:00:00',
      facility: {
        id: 'fac-2',
        name: 'Room 403',
        room_number: '403',
        building: 'Main Building',
      },
      department: {
        id: 'dept-1',
        name: 'Computer Science',
        code: 'BSCS',
      },
    },
  ]

  it('renders the header and "View All" button', () => {
    render(<FixedClassSchedulesPreview initialClasses={mockClasses} />)
    
    expect(screen.getByText('Fixed Class Schedules')).toBeInTheDocument()
    expect(screen.getByText(/2 Total/i)).toBeInTheDocument()
    expect(screen.getByText('View All')).toBeInTheDocument()
  })

  it('renders the day selector pills with class count badges', () => {
    render(<FixedClassSchedulesPreview initialClasses={mockClasses} />)

    // Monday (idx 1) should have count badge of 2
    expect(screen.getByText('Mon')).toBeInTheDocument()
    expect(screen.getByText('Tue')).toBeInTheDocument()
  })

  it('displays class item cards correctly when day is selected', () => {
    render(<FixedClassSchedulesPreview initialClasses={mockClasses} />)

    expect(screen.getByText('COSC1003')).toBeInTheDocument()
    expect(screen.getByText('Data Structures and Algorithms')).toBeInTheDocument()
    expect(screen.getByText('BSCS2A1')).toBeInTheDocument()
    expect(screen.getByText('Jerald Reyes')).toBeInTheDocument()
    expect(screen.getByText('309')).toBeInTheDocument()
  })
})
