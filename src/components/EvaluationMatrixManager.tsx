import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  Table,
  Button,
  Modal,
  Form,
  DatePicker,
  message,
  Space,
  Popconfirm,
  Tooltip,
  Select,
  Tabs,
  Card,
  Tag
} from 'antd';
import { CopyOutlined, UserAddOutlined, ExclamationCircleOutlined } from '@ant-design/icons';

const { TabPane } = Tabs;
const { Option } = Select;

interface Matrix {
  id: number;
  title: string;
  description: string;
  validFrom: string;
  validTo: string;
  status: string;
}

interface MatrixApplicability {
  id: number;
  matrixId: number;
  employeeId: string;
  employeeName: string;
  validFrom: string;
  validTo: string;
  status: string;
}

interface Employee {
  id: string;
  name: string;
  department: string;
}

export const EvaluationMatrixManager: React.FC = () => {
  const [matrices, setMatrices] = useState<Matrix[]>([]);
  const [applicabilities, setApplicabilities] = useState<MatrixApplicability[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedMatrix, setSelectedMatrix] = useState<Matrix | null>(null);
  const [isApplyModalVisible, setIsApplyModalVisible] = useState(false);
  const [isCopyModalVisible, setIsCopyModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  // Fetch matrices and employees
  useEffect(() => {
    fetchMatrices();
    fetchEmployees();
  }, []);

  const fetchMatrices = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/evaluation-matrices');
      const data = await response.json();
      setMatrices(data);
    } catch (error) {
      message.error('Error fetching matrices');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/employees');
      const data = await response.json();
      setEmployees(data);
    } catch (error) {
      message.error('Error fetching employees');
    }
  };

  const fetchApplicabilities = async (matrixId: number) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/evaluation-matrices/${matrixId}/applicability`);
      const data = await response.json();
      setApplicabilities(data);
    } catch (error) {
      message.error('Error fetching matrix applicability');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyMatrix = async (values: any) => {
    try {
      setLoading(true);
      const response = await fetch('/api/evaluation/matrix/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matrixId: selectedMatrix?.id,
          employeeIds: values.employeeIds,
          validFrom: values.validFrom,
          validTo: values.validTo
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      message.success('Matrix applied successfully');
      setIsApplyModalVisible(false);
      form.resetFields();
      fetchApplicabilities(selectedMatrix!.id);
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyMatrix = async (values: any) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/evaluation/matrix/${selectedMatrix?.id}/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newValidFrom: values.newValidFrom,
          newValidTo: values.newValidTo,
          employeeIds: values.employeeIds
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      message.success('Matrix copied and extended successfully');
      setIsCopyModalVisible(false);
      form.resetFields();
      fetchMatrices();
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const matrixColumns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title'
    },
    {
      title: 'Valid From',
      dataIndex: 'validFrom',
      key: 'validFrom',
      render: (date: string) => format(new Date(date), 'dd/MM/yyyy')
    },
    {
      title: 'Valid To',
      dataIndex: 'validTo',
      key: 'validTo',
      render: (date: string) => format(new Date(date), 'dd/MM/yyyy')
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status.toUpperCase()}
        </Tag>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: Matrix) => (
        <Space>
          <Tooltip title="Apply to employees">
            <Button
              icon={<UserAddOutlined />}
              onClick={() => {
                setSelectedMatrix(record);
                setIsApplyModalVisible(true);
              }}
            />
          </Tooltip>
          <Tooltip title="Copy and extend">
            <Button
              icon={<CopyOutlined />}
              onClick={() => {
                setSelectedMatrix(record);
                setIsCopyModalVisible(true);
              }}
            />
          </Tooltip>
        </Space>
      )
    }
  ];

  const applicabilityColumns = [
    {
      title: 'Employee',
      dataIndex: 'employeeName',
      key: 'employeeName'
    },
    {
      title: 'Valid From',
      dataIndex: 'validFrom',
      key: 'validFrom',
      render: (date: string) => format(new Date(date), 'dd/MM/yyyy')
    },
    {
      title: 'Valid To',
      dataIndex: 'validTo',
      key: 'validTo',
      render: (date: string) => format(new Date(date), 'dd/MM/yyyy')
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status.toUpperCase()}
        </Tag>
      )
    }
  ];

  return (
    <div>
      <Tabs defaultActiveKey="matrices">
        <TabPane tab="Matrices" key="matrices">
          <Table
            dataSource={matrices}
            columns={matrixColumns}
            rowKey="id"
            loading={loading}
            onRow={(record) => ({
              onClick: () => {
                setSelectedMatrix(record);
                fetchApplicabilities(record.id);
              }
            })}
          />
        </TabPane>
        {selectedMatrix && (
          <TabPane tab="Applicability" key="applicability">
            <Card title={`Matrix: ${selectedMatrix.title}`}>
              <Table
                dataSource={applicabilities}
                columns={applicabilityColumns}
                rowKey="id"
                loading={loading}
              />
            </Card>
          </TabPane>
        )}
      </Tabs>

      {/* Apply Matrix Modal */}
      <Modal
        title="Apply Matrix to Employees"
        visible={isApplyModalVisible}
        onCancel={() => setIsApplyModalVisible(false)}
        footer={null}
      >
        <Form form={form} onFinish={handleApplyMatrix}>
          <Form.Item
            name="employeeIds"
            label="Employees"
            rules={[{ required: true, message: 'Please select employees' }]}
          >
            <Select
              mode="multiple"
              placeholder="Select employees"
              style={{ width: '100%' }}
              optionFilterProp="children"
            >
              {employees.map(employee => (
                <Option key={employee.id} value={employee.id}>
                  {employee.name} ({employee.department})
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="validFrom"
            label="Valid From"
            rules={[{ required: true, message: 'Please select start date' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="validTo"
            label="Valid To"
            rules={[{ required: true, message: 'Please select end date' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              Apply
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Copy Matrix Modal */}
      <Modal
        title="Copy and Extend Matrix"
        visible={isCopyModalVisible}
        onCancel={() => setIsCopyModalVisible(false)}
        footer={null}
      >
        <Form form={form} onFinish={handleCopyMatrix}>
          <Form.Item
            name="newValidFrom"
            label="New Valid From"
            rules={[{ required: true, message: 'Please select start date' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="newValidTo"
            label="New Valid To"
            rules={[{ required: true, message: 'Please select end date' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="employeeIds"
            label="Specific Employees (Optional)"
            tooltip="If selected, creates specific versions for these employees"
          >
            <Select
              mode="multiple"
              placeholder="Select employees (optional)"
              style={{ width: '100%' }}
              optionFilterProp="children"
            >
              {employees.map(employee => (
                <Option key={employee.id} value={employee.id}>
                  {employee.name} ({employee.department})
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              Copy and Extend
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}; 