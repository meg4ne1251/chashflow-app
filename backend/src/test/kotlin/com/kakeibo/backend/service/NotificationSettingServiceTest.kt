package com.kakeibo.backend.service

import com.kakeibo.backend.middleware.ConflictException
import com.kakeibo.backend.middleware.ValidationException
import com.kakeibo.backend.repository.NotificationSettingRepository
import com.kakeibo.shared.model.NotificationSettingRequest
import io.mockk.every
import io.mockk.mockk
import java.util.*
import kotlin.test.*

class NotificationSettingServiceTest {
    private lateinit var repository: NotificationSettingRepository
    private lateinit var sut: NotificationSettingService

    @BeforeTest
    fun setUp() {
        repository = mockk(relaxed = true)
        sut = NotificationSettingService(repository)
    }

    private val id = UUID.randomUUID().toString()

    @Test
    fun `update - requires version`() {
        assertFailsWith<ValidationException> {
            sut.update(id, NotificationSettingRequest(is_enabled = true, version = null))
        }
    }

    @Test
    fun `update - rejects invalid time_of_day format`() {
        assertFailsWith<ValidationException> {
            sut.update(id, NotificationSettingRequest(time_of_day = "25:99", version = 1))
        }
    }

    @Test
    fun `update - rejects threshold below 1`() {
        assertFailsWith<ValidationException> {
            sut.update(id, NotificationSettingRequest(threshold_percent = 0, version = 1))
        }
    }

    @Test
    fun `update - rejects threshold above 100`() {
        assertFailsWith<ValidationException> {
            sut.update(id, NotificationSettingRequest(threshold_percent = 101, version = 1))
        }
    }

    @Test
    fun `update - rejects reminder_days_before above 31`() {
        assertFailsWith<ValidationException> {
            sut.update(id, NotificationSettingRequest(reminder_days_before = 32, version = 1))
        }
    }

    @Test
    fun `update - rejects negative reminder_days_before`() {
        assertFailsWith<ValidationException> {
            sut.update(id, NotificationSettingRequest(reminder_days_before = -1, version = 1))
        }
    }

    @Test
    fun `update - throws ConflictException when repository returns null`() {
        every {
            repository.update(any(), any(), any(), any(), any(), any(), any(), any())
        } returns null

        assertFailsWith<ConflictException> {
            sut.update(id, NotificationSettingRequest(is_enabled = true, threshold_percent = 80, version = 1))
        }
    }
}
