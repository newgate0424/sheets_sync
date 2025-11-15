import { google } from 'googleapis'
import fs from 'fs'
import path from 'path'

interface GoogleSheetsConfig {
  spreadsheetId: string
  sheetName?: string
  range?: string
}

export class GoogleSheetsService {
  private sheets

  constructor() {
    // อ่านไฟล์ credentials.json
    const credentialsPath = path.join(process.cwd(), 'credentials.json')
    let credentials: any

    if (fs.existsSync(credentialsPath)) {
      // ถ้ามีไฟล์ credentials.json ให้ใช้ไฟล์นั้น
      const credentialsFile = fs.readFileSync(credentialsPath, 'utf8')
      credentials = JSON.parse(credentialsFile)
    } else {
      // ถ้าไม่มีไฟล์ ให้ใช้ค่าจาก .env (สำหรับ backward compatibility)
      credentials = {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })

    this.sheets = google.sheets({ version: 'v4', auth })
  }

  /**
   * ตรวจสอบว่า Spreadsheet ID ถูกต้องหรือไม่
   */
  async validateSpreadsheet(spreadsheetId: string) {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId,
      })
      return {
        valid: true,
        title: response.data.properties?.title,
        sheets: response.data.sheets?.map((sheet) => ({
          title: sheet.properties?.title || '',
          sheetId: sheet.properties?.sheetId || 0,
          rowCount: sheet.properties?.gridProperties?.rowCount || 0,
          columnCount: sheet.properties?.gridProperties?.columnCount || 0,
        })),
      }
    } catch (error: any) {
      return {
        valid: false,
        error: error.message,
      }
    }
  }

  /**
   * ดึงข้อมูลจาก Google Sheets
   * รองรับการดึงข้อมูลแบบ Batch (ทีละหลายพัน/หมื่นแถว)
   */
  async getSheetData(config: GoogleSheetsConfig, startRow: number = 1, batchSize: number = 50000) {
    try {
      const { spreadsheetId, sheetName, range } = config

      // ถ้ามี range ระบุมาให้ใช้เลย
      let queryRange = range
      
      // ถ้าไม่มี range แต่มี sheetName ให้ดึงทั้งหมด
      if (!queryRange && sheetName) {
        // ดึงแบบ batch เพื่อประสิทธิภาพ
        const endRow = startRow + batchSize - 1
        queryRange = `${sheetName}!A${startRow}:ZZ${endRow}`
      }

      if (!queryRange) {
        throw new Error('ต้องระบุ range หรือ sheetName')
      }

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: queryRange,
        valueRenderOption: 'UNFORMATTED_VALUE', // ดึงค่าดิบ
        dateTimeRenderOption: 'FORMATTED_STRING',
      })

      const rows = response.data.values || []
      
      return {
        success: true,
        data: rows,
        rowCount: rows.length,
        startRow,
        endRow: startRow + rows.length - 1,
      }
    } catch (error: any) {
      console.error('Error fetching sheet data:', error)
      return {
        success: false,
        error: error.message,
        data: [],
        rowCount: 0,
      }
    }
  }

  /**
   * ดึง Header (แถวแรก) ของ Sheet เพื่อใช้สร้าง Schema
   */
  async getSheetHeaders(spreadsheetId: string, sheetName: string) {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!1:1`,
      })

      const headers = response.data.values?.[0] || []
      return {
        success: true,
        headers,
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        headers: [],
      }
    }
  }

  /**
   * นับจำนวนแถวทั้งหมดใน Sheet
   */
  async getSheetRowCount(spreadsheetId: string, sheetName: string): Promise<number> {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId,
        ranges: [sheetName],
      })

      const sheet = response.data.sheets?.[0]
      return sheet?.properties?.gridProperties?.rowCount || 0
    } catch (error) {
      console.error('Error getting row count:', error)
      return 0
    }
  }
}

export const googleSheetsService = new GoogleSheetsService()
