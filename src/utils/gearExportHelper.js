import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useToast } from 'vue-toastification'

export async function exportGearToPDF(filteredMainGearList, filteredAccessoriesList, filterLocationId, locationsList, route) {
  const toast = useToast()
  
  const doc = new jsPDF()
  const title =
    filterLocationId.value === 'all' ? 'All Gear' :
    filterLocationId.value === 'unassigned' ? 'Unassigned Gear' :
    filterLocationId.value === 'assigned' ? 'Assigned Gear' :
    `Gear for ${locationsList.value.find(l => String(l.id) === filterLocationId.value)?.stage_name}`
  
  doc.setFontSize(16)
  doc.text(title, 10, 20)
  
  const mainData = filteredMainGearList.value.map(g => [
    g.gear_name, g.gear_type, g.gear_amount,
    g.unassigned_amount, g.total_assigned,
    g.is_rented ? 'Yes' : 'No', g.vendor || ''
  ])
  
  const accessoriesData = filteredAccessoriesList.value.map(g => [
    g.gear_name, g.gear_type, g.gear_amount,
    g.unassigned_amount, g.total_assigned,
    g.is_rented ? 'Yes' : 'No', g.vendor || ''
  ])
  
  const data = [...mainData, ...accessoriesData]
  
  autoTable(doc, {
    startY: 30,
    head: [['Name', 'Type', 'Total', 'Unassigned', 'Assigned', 'Rented?', 'Vendor']],
    body: data
  })
  
  // Save PDF to storage
  const filename = `gear_${new Date().toISOString().slice(0, 10)}.pdf`
  const { savePDFToStorage, showExportSuccessToast } = await import('@/services/exportStorageService')
  const description = `Gear export - ${title}`
  const projectId = route?.params?.id

  const result = await savePDFToStorage(
    doc,
    filename,
    projectId,
    null, // venueId - project level
    null, // stageId - project level
    description
  )

  showExportSuccessToast(toast, result, filename)
  
  return result
}

