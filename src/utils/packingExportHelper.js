import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import PackingService from '@/services/packingService'

export async function printBagInventory(bag, effectiveProjectId, currentProject) {
  try {
    const inventory = await PackingService.getBagInventoryForPrint(bag.id)
    const items = await PackingService.getBagItems(bag.id)
    
    const doc = new jsPDF()
    let yPosition = 20
    
    // Project name
    if (currentProject?.value?.project_name) {
      doc.setFontSize(14)
      doc.text(`Project: ${currentProject.value.project_name}`, 10, yPosition)
      yPosition += 10
    }
    
    // Bag name
    doc.setFontSize(16)
    doc.text(bag.name, 10, yPosition)
    yPosition += 10
    
    // Bag description
    if (bag.description) {
      doc.setFontSize(12)
      doc.text(bag.description, 10, yPosition)
      yPosition += 10
    }
    
    yPosition += 5
    
    // Items table
    const tableData = items.map(item => [
      item.gear_name || 'Unknown',
      item.quantity || 0,
      item.checked ? '✓' : ''
    ])
    
    autoTable(doc, {
      startY: yPosition,
      head: [['Item', 'Quantity', 'Checked']],
      body: tableData
    })
    
    // Save PDF to storage
    const filename = `packing_bag_${bag.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
    const { savePDFToStorage } = await import('@/services/exportStorageService')
    const description = `Packing bag inventory - ${bag.name}`
    const projectId = effectiveProjectId.value

    const result = await savePDFToStorage(
      doc,
      filename,
      projectId,
      null,
      null,
      description
    )

    return result
  } catch (err) {
    console.error('Failed to print bag inventory:', err)
    return { success: false, error: err.message }
  }
}

export async function printMyGearInventory(bags, effectiveProjectId, currentProject) {
  try {
    const doc = new jsPDF()
    let yPosition = 20
    
    // Project name
    if (currentProject?.value?.project_name) {
      doc.setFontSize(14)
      doc.text(`Project: ${currentProject.value.project_name}`, 10, yPosition)
      yPosition += 10
    }
    
    // Title
    doc.setFontSize(16)
    doc.text('My Packing Bags Inventory', 10, yPosition)
    yPosition += 15
    
    // Print each bag
    for (const bag of bags.value) {
      if (yPosition > 250) {
        doc.addPage()
        yPosition = 20
      }
      
      doc.setFontSize(14)
      doc.text(bag.name, 10, yPosition)
      yPosition += 8
      
      if (bag.description) {
        doc.setFontSize(10)
        doc.text(bag.description, 10, yPosition)
        yPosition += 6
      }
      
      const items = await PackingService.getBagItems(bag.id)
      if (items.length > 0) {
        const tableData = items.map(item => [
          item.gear_name || 'Unknown',
          item.quantity || 0,
          item.checked ? '✓' : ''
        ])
        
        autoTable(doc, {
          startY: yPosition,
          head: [['Item', 'Quantity', 'Checked']],
          body: tableData,
          margin: { left: 10 }
        })
        
        yPosition = doc.lastAutoTable.finalY + 15
      } else {
        yPosition += 5
      }
    }
    
    // Save PDF to storage
    const filename = `all_packing_bags_${new Date().toISOString().slice(0, 10)}.pdf`
    const { savePDFToStorage } = await import('@/services/exportStorageService')
    const description = 'All packing bags inventory'
    const projectId = effectiveProjectId.value

    const result = await savePDFToStorage(
      doc,
      filename,
      projectId,
      null,
      null,
      description
    )

    return result
  } catch (err) {
    console.error('Failed to print gear inventory:', err)
    return { success: false, error: err.message }
  }
}

